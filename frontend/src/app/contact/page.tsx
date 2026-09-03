import type { Metadata } from "next";
import LegalPage, { LegalHeading } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Contact — CareerNeeti",
  description:
    "How to reach CareerNeeti about your report, your data, or bringing the assessment to your school.",
};

// See the note in privacy/page.tsx — these must be real values before publishing.
const ENTITY = "[registered entity name]";
const ADDRESS = "[registered address]";
const CONTACT_EMAIL = "[contact email]";
const GRIEVANCE_NAME = "[grievance officer name]";
const GRIEVANCE_EMAIL = "[grievance officer email]";

export default function Contact() {
  return (
    <LegalPage title="Contact Us" lastUpdated="2 September 2026">
      <p>
        We read everything that comes in and reply as quickly as we reasonably can. There is no
        contact form here on purpose — email reaches a person directly.
      </p>

      <LegalHeading>General enquiries</LegalHeading>
      <p>{CONTACT_EMAIL}</p>

      <LegalHeading>Your report</LegalHeading>
      <p>
        If your report has not arrived, or something in it looks wrong, email us with the link you
        were given and we will look into it. Please do not send us your password or any payment
        details — we will never ask for them.
      </p>

      <LegalHeading>Your data</LegalHeading>
      <p>
        To see what personal data we hold, correct it, delete it, or withdraw consent, write to our
        grievance officer:
        <br />
        {GRIEVANCE_NAME}
        <br />
        {GRIEVANCE_EMAIL}
      </p>
      <p>
        We respond to these requests within 30 days. See the{" "}
        <a href="/privacy" className="text-secondary underline">Privacy Policy</a> for the full
        detail of what we hold and why.
      </p>

      <LegalHeading>For schools</LegalHeading>
      <p>
        If you would like to run CareerNeeti as a structured session for a class or a whole cohort,
        email {CONTACT_EMAIL} with your school&rsquo;s name, location and the classes you have in
        mind, and we will get back to you.
      </p>

      <LegalHeading>Postal address</LegalHeading>
      <p>
        {ENTITY}
        <br />
        {ADDRESS}
      </p>
    </LegalPage>
  );
}
