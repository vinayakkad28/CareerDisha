import type { Metadata } from "next";
import LegalPage, { LegalHeading } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — CareerNeeti",
  description:
    "How CareerNeeti collects, uses, stores and deletes personal data, including the data of students under 18.",
};

// NOTE FOR THE OPERATOR: the bracketed placeholders below are the only details
// this file cannot derive from the codebase. They must be filled in with real
// values before this page is treated as a published notice — a privacy policy
// naming a fictitious entity or an unmonitored address is worse than none.
const ENTITY = "[registered entity name]";
const ADDRESS = "[registered address]";
const GRIEVANCE_EMAIL = "[grievance officer email]";
const GRIEVANCE_NAME = "[grievance officer name]";

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="2 September 2026">
      <p>
        This notice explains what personal data CareerNeeti (&ldquo;we&rdquo;) collects, why we
        collect it, who we share it with, and how you can have it corrected or deleted. It is
        written to meet the notice requirement under Section 5 of India&rsquo;s Digital Personal
        Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;).
      </p>
      <p>
        CareerNeeti is operated by {ENTITY}, {ADDRESS}.
      </p>

      <LegalHeading>Who this service is for</LegalHeading>
      <p>
        CareerNeeti is a career-guidance assessment intended for school students, typically aged
        13&ndash;18. Most of the people whose data we process are therefore <strong>children</strong>
        under the DPDP Act, which defines a child as anyone under 18. We treat all assessment data as
        children&rsquo;s data unless we know otherwise.
      </p>

      <LegalHeading>What we collect</LegalHeading>
      <p>When you take the assessment, we collect:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Identity and contact:</strong> the student&rsquo;s name, class level, and — where
          provided — an email address and a parent or guardian&rsquo;s phone number.
        </li>
        <li>
          <strong>Background context:</strong> gender, household income band, location type,
          parental education, whether the student is a first-generation learner, school subject
          marks, willingness to relocate, and affordability of coaching.
        </li>
        <li>
          <strong>Assessment responses and scores:</strong> answers to the RIASEC interest
          inventory, work-value items, a self-efficacy scale, a short personality inventory (TIPI),
          a career-readiness scale, and an optional timed aptitude section — together with the
          scores derived from them.
        </li>
        <li>
          <strong>The generated report</strong> and the PDF produced from it.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> use advertising trackers, analytics pixels, or third-party
        cookies anywhere on this site. Section 9(3) of the DPDP Act prohibits behavioural tracking
        and targeted advertising directed at children, and we do not do it.
      </p>

      <LegalHeading>Why we collect it</LegalHeading>
      <p>
        Solely to produce and deliver the student&rsquo;s career report, and to support the
        student and their parent or guardian in acting on it. Background context is used because a
        recommendation that ignores affordability, location, or family circumstances is not useful
        advice. We do not sell personal data.
      </p>

      <LegalHeading>Parental consent</LegalHeading>
      <p>
        Where the student is under 18, we require verifiable consent from a parent or guardian
        before the report is generated. Consent is confirmed by a one-time code sent to the parent
        or guardian&rsquo;s phone number. Assessment answers may be scored to show an on-screen
        preview before that point, but no report is generated or stored without confirmed consent.
      </p>

      <LegalHeading>Who we share it with</LegalHeading>
      <p>
        We use a small number of processors to run the service. Assessment scores and background
        context are sent to a large language model provider to generate the report narrative; the
        student&rsquo;s name is <strong>not</strong> included in that request. Our processors are:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Google</strong> (Gemini API) &mdash; generates the report narrative from
          assessment scores. Processed outside India.
        </li>
        <li>
          <strong>Render</strong> &mdash; application hosting.
        </li>
        <li>
          <strong>Neon</strong> &mdash; database hosting.
        </li>
        <li>
          <strong>Vercel</strong> &mdash; hosting for this website.
        </li>
        <li>
          <strong>Sentry</strong> &mdash; error monitoring.
        </li>
      </ul>
      <p>
        Because some of these providers process data outside India, taking the assessment involves a
        cross-border transfer of personal data.
      </p>

      <LegalHeading>How long we keep it</LegalHeading>
      <p>
        We retain assessment data for 90 days after the report is delivered, after which identifying
        fields are erased automatically. Aggregate, non-identifying statistics may be retained
        longer.
      </p>

      <LegalHeading>Your rights</LegalHeading>
      <p>
        You may ask us to show you the personal data we hold about you, correct it, delete it, or
        withdraw consent. Withdrawing consent stops further processing and deletes the report.
        Write to the grievance officer below and we will respond within 30 days.
      </p>

      <LegalHeading>Grievance officer</LegalHeading>
      <p>
        As required by Section 13 of the DPDP Act:
        <br />
        {GRIEVANCE_NAME}
        <br />
        {GRIEVANCE_EMAIL}
      </p>
      <p>
        If you are not satisfied with our response, you may complain to the Data Protection Board of
        India.
      </p>
    </LegalPage>
  );
}
