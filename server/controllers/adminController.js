const User = require('../models/User');
const Chat = require('../models/Chat');

const MAX_CREDITS = 10;

const getAdminOverview = async (req, res) => {
  try {
    const [users, chats] = await Promise.all([
      User.find({}).lean(),
      Chat.find({}).lean(),
    ]);

    // ── Per-user stats ──────────────────────────────────
    const chatsByUser = {};
    chats.forEach((chat) => {
      const uid = chat.userId.toString();
      if (!chatsByUser[uid]) chatsByUser[uid] = [];
      chatsByUser[uid].push(chat);
    });

    const userList = users.map((user) => {
      const userChats = chatsByUser[user._id.toString()] || [];
      const totalMessages = userChats.reduce(
        (sum, c) => sum + c.messages.filter((m) => m.role === 'user').length,
        0
      );
      const credits = user.credits ?? MAX_CREDITS;
      return {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        credits,
        creditsUsed: Math.max(0, MAX_CREDITS - credits),
        totalChats: userChats.length,
        totalMessages,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      };
    });

    // ── Global stats ────────────────────────────────────
    const totalUsers = users.length;
    const totalChats = chats.length;
    const totalMessages = chats.reduce(
      (sum, c) => sum + c.messages.filter((m) => m.role === 'user').length,
      0
    );
    const totalCreditsUsed = userList.reduce((sum, u) => sum + u.creditsUsed, 0);

    // ── Activity: messages per day (last 7 days) ────────
    const now = new Date();
    const activityMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      activityMap[d.toISOString().split('T')[0]] = 0;
    }
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    chats.forEach((chat) => {
      const chatDate = new Date(chat.updatedAt);
      if (chatDate >= sevenDaysAgo) {
        const key = chatDate.toISOString().split('T')[0];
        if (key in activityMap) {
          activityMap[key] += chat.messages.filter((m) => m.role === 'user').length;
        }
      }
    });

    const activity = Object.entries(activityMap).map(([date, count]) => ({
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short' }),
      count,
    }));

    return res.status(200).json({
      success: true,
      data: {
        users: userList,
        stats: { totalUsers, totalChats, totalMessages, totalCreditsUsed },
        activity,
      },
    });
  } catch (err) {
    console.error('Admin overview error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAdminOverview };
