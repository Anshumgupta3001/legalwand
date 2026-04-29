const User = require('../models/User');
const Chat = require('../models/Chat');

const MAX_CREDITS = 10;

const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, chats] = await Promise.all([
      User.findById(userId),
      Chat.find({ userId }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // ── Stats ──────────────────────────────────────────
    const totalChats = chats.length;
    const totalMessages = chats.reduce(
      (sum, c) => sum + c.messages.filter((m) => m.role === 'user').length,
      0
    );

    const lastActive =
      chats.length > 0
        ? chats.reduce(
            (latest, c) => (c.updatedAt > latest ? c.updatedAt : latest),
            chats[0].updatedAt
          )
        : null;

    // ── Activity: chats active per day (last 7 days) ──
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
          // Count user messages in this chat as activity on that day
          activityMap[key] += chat.messages.filter((m) => m.role === 'user').length;
        }
      }
    });

    const activity = Object.entries(activityMap).map(([date, count]) => ({
      date,
      // Short label: "Mon", "Tue", etc.
      label: new Date(date + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short' }),
      count,
    }));

    // ── Recent chats (last 5) ──────────────────────────
    const recentChats = [...chats]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map((chat) => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        return {
          id: chat._id,
          title: chat.title,
          lastMessage: lastMsg ? lastMsg.content.slice(0, 100) : '',
          messageCount: chat.messages.length,
          updatedAt: chat.updatedAt,
        };
      });

    // ── Credits ────────────────────────────────────────
    const creditsRemaining = user.credits ?? MAX_CREDITS;
    const creditsUsed = Math.max(0, MAX_CREDITS - creditsRemaining);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          credits: creditsRemaining,
          creditsUsed,
          totalCredits: MAX_CREDITS,
        },
        stats: {
          totalChats,
          totalMessages,
          lastActive,
        },
        activity,
        recentChats,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboard };
