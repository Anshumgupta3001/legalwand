import React from 'react';
import { Link } from 'react-router-dom';

const ACC = '#BC6C5F';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#1f1510' }}>{title}</h2>
    <div className="text-[14px] leading-relaxed space-y-2" style={{ color: '#5a4c3c' }}>
      {children}
    </div>
  </div>
);

const Terms = () => (
  <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
    {/* Header */}
    <div className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
      <Link to="/signup" className="flex items-center gap-2 text-[14px] font-medium" style={{ color: ACC }}>
        ← Back to Sign Up
      </Link>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: ACC }}>⚖️</div>
        <span className="font-serif text-[16px] font-semibold" style={{ color: '#1f1510' }}>
          GST<span style={{ color: ACC }}>Wand</span>
        </span>
      </div>
    </div>

    {/* Content */}
    <div className="max-w-3xl mx-auto px-6 pb-16">
      <div className="rounded-2xl p-8 mb-2" style={{ backgroundColor: '#fff', boxShadow: '0 2px 12px rgba(26,18,8,0.06)' }}>

        {/* Title */}
        <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #e8e0d4' }}>
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: ACC }}>Legal</div>
          <h1 className="font-serif text-[28px] font-semibold mb-2" style={{ color: '#1f1510' }}>
            Terms of Service &amp; Privacy Policy
          </h1>
          <p className="text-[13px]" style={{ color: '#9a8c7c' }}>
            Last updated: March 2025 &nbsp;·&nbsp; Effective immediately upon account creation
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>
            By creating an account on GSTWand ("Platform", "we", "us"), you agree to these Terms of Service
            and Privacy Policy. If you do not agree, please do not use the Platform.
          </p>
          <p>
            These terms apply to all users including individuals, businesses, Chartered Accountants (CAs),
            and tax consultants accessing the Platform.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            GSTWand is a GST compliance assistance platform that provides:
          </p>
          <ul className="list-none space-y-1 pl-3">
            {[
              'AI-powered GST query resolution and guidance',
              'Information on GST registration, filing, and compliance',
              'GSTR return filing assistance and ITC reconciliation guidance',
              'GST rate lookups, HSN/SAC code information',
              'News and updates related to GST and Indian taxation',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACC }} />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            GSTWand is an <strong>informational tool only</strong>. It does not constitute professional
            legal, financial, or tax advice. For complex matters, always consult a qualified CA or tax professional.
          </p>
        </Section>

        <Section title="3. User Accounts &amp; Eligibility">
          <p>
            You must be at least 18 years old and a registered business entity or individual in India to use GSTWand.
            You are responsible for maintaining the confidentiality of your account credentials.
          </p>
          <p>
            You agree to provide accurate registration information including your name, email, and GSTIN (if applicable).
            Providing false information may result in immediate account termination.
          </p>
        </Section>

        <Section title="4. Credits &amp; Free Plan">
          <p>
            New accounts receive <strong>10 free AI chat credits</strong>. Each AI response consumes one credit.
            Free credits are non-transferable, non-refundable, and expire with the account.
          </p>
          <p>
            Pro plan pricing will be announced. We reserve the right to change credit limits or pricing with
            30 days' notice to registered users.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree NOT to:</p>
          <ul className="list-none space-y-1 pl-3">
            {[
              'Use the Platform for any unlawful purpose or in violation of Indian tax laws',
              'Attempt to reverse-engineer, scrape, or extract AI model outputs at scale',
              'Share your account with third parties or resell Platform access',
              'Upload files containing malware, illegal content, or third-party confidential data without authorisation',
              'Misrepresent AI-generated information as certified professional advice',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#c0392b' }} />
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="6. File Uploads">
          <p>
            You may upload files (PDF, DOCX, TXT) to the Platform for AI-assisted analysis. By uploading a file, you confirm:
          </p>
          <ul className="list-none space-y-1 pl-3">
            {[
              'You own or have rights to the content in the file',
              'The file does not contain sensitive third-party personal data without consent',
              'The file is not malicious or in violation of any applicable law',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACC }} />
                {item}
              </li>
            ))}
          </ul>
          <p>
            Uploaded file content is processed in-memory only and is <strong>not stored in any database</strong>.
            It is discarded when you log out or the session ends.
          </p>
        </Section>

        <Section title="7. Privacy Policy — Data We Collect">
          <p>We collect and store the following data when you register:</p>
          <ul className="list-none space-y-1 pl-3">
            {[
              'Name, email address, and mobile number',
              'GSTIN, company name, and business type (if provided)',
              'Chat history and AI interactions within your account',
              'Login timestamps and session metadata',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACC }} />
                {item}
              </li>
            ))}
          </ul>
          <p>
            We do <strong>not</strong> sell your personal data to third parties. Data is used solely to
            provide and improve the Platform's services.
          </p>
        </Section>

        <Section title="8. Data Security">
          <p>
            All data is transmitted over 256-bit SSL/TLS encryption. Passwords are hashed using bcrypt
            with a salt factor of 12. We use MongoDB Atlas with IP-whitelisted access and JWT-based
            stateless authentication.
          </p>
          <p>
            While we take commercially reasonable security measures, no system is 100% secure. You use
            the Platform at your own risk.
          </p>
        </Section>

        <Section title="9. AI Disclaimer">
          <p>
            GSTWand uses AI (OpenAI GPT models) to provide GST-related guidance. AI responses are
            generated automatically and may contain errors, outdated information, or inaccuracies.
          </p>
          <p>
            <strong>AI responses do not constitute professional tax advice.</strong> Always verify
            information with the official GSTN portal (<a href="https://www.gst.gov.in" target="_blank" rel="noreferrer" className="underline" style={{ color: ACC }}>gst.gov.in</a>) or
            a qualified Chartered Accountant before acting on it.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            GSTWand and its operators shall not be liable for any direct, indirect, incidental, or
            consequential damages arising from:
          </p>
          <ul className="list-none space-y-1 pl-3">
            {[
              'Reliance on AI-generated tax guidance without professional verification',
              'Missed GST filing deadlines or incorrect return filings',
              'Any penalties, interest, or notices from the GST Department',
              'Service interruptions, data loss, or security breaches beyond our reasonable control',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#b8860b' }} />
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="11. Termination">
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms, engage in
            fraudulent activity, or misuse the Platform. You may delete your account at any time by
            contacting support@gstwand.com.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These terms are governed by the laws of India. Any disputes shall be subject to the exclusive
            jurisdiction of courts in New Delhi, India.
          </p>
        </Section>

        <Section title="13. Changes to Terms">
          <p>
            We may update these terms periodically. Continued use of the Platform after changes
            constitutes acceptance of the revised terms. Material changes will be notified via email.
          </p>
        </Section>

        {/* Contact */}
        <div className="mt-8 pt-6 rounded-xl p-5 text-center" style={{ borderTop: '1px solid #e8e0d4', backgroundColor: '#faf8f5' }}>
          <p className="text-[13px] font-medium mb-1" style={{ color: '#1f1510' }}>Questions about these terms?</p>
          <p className="text-[13px]" style={{ color: '#9a8c7c' }}>
            Email us at{' '}
            <a href="mailto:support@gstwand.com" className="font-semibold hover:underline" style={{ color: ACC }}>
              support@gstwand.com
            </a>
          </p>
          <p className="text-[11px] mt-3" style={{ color: '#c4b49a' }}>
            © 2025 GSTWand · 256-bit SSL · GSTN Approved · SOC 2 Type II
          </p>
        </div>

      </div>
    </div>
  </div>
);

export default Terms;
