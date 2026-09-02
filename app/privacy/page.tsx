import type { Metadata } from "next";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Analyst Studio",
};

/**
 * Written from what the application actually does, not from a template.
 *
 * The third-party processing disclosure is the part that matters: uploaded
 * documents are sent to Anthropic to be analysed, and anyone uploading a client
 * transcript needs to know that before they do it, not after.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        <strong>Last updated 3 September 2026.</strong> Analyst Studio is
        operated by VanThroo Technologies and is currently in closed testing.
      </p>

      <h2>What we store</h2>
      <p>
        <strong>Your email address.</strong> This is the only personal detail we
        ask for. There is no password — you sign in with a one-time link sent to
        your address, so there is nothing to leak or reset.
      </p>
      <p>
        <strong>The documents you upload.</strong> Transcripts, notes and
        specifications, stored as text exactly as you supplied them.
      </p>
      <p>
        <strong>What we derive from them.</strong> The requirements, rules and
        acceptance criteria extracted from your documents, including the
        verbatim quotes that support each one.
      </p>
      <p>
        <strong>Sign-in sessions.</strong> A session record so you stay signed
        in, which expires on its own.
      </p>

      <h2>Your documents are sent to Anthropic</h2>
      <p>
        This is the most important thing on this page. To extract requirements,
        we send the full text of your uploaded documents to Anthropic&apos;s
        API, which is the service that analyses them. Anthropic processes that
        text to produce a response and does not use it to train their models.
      </p>
      <p>
        Please do not upload anything you are not permitted to share with a
        third-party processor. If your client agreement, your employer or a
        regulator restricts where material may be sent, that restriction applies
        here. Material covered by legal privilege, or containing personal data
        you have no lawful basis to share, should not be uploaded.
      </p>

      <h2>Who else touches your data</h2>
      <p>
        <strong>Supabase</strong> hosts the database, in the EU (Ireland).{" "}
        <strong>Vercel</strong> hosts and runs the application.{" "}
        <strong>Resend</strong> sends the sign-in emails and therefore sees your
        email address. <strong>Anthropic</strong> processes document text as
        described above. We do not sell your data, and we do not share it with
        anyone else.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Until you delete it. Deleting a project removes its documents,
        requirements and findings immediately and permanently — there is no
        recycle bin and no undo. There is no automatic deletion, so anything you
        leave in place stays until you remove it.
      </p>
      <p>
        To have your account and everything in it deleted, email us at the
        address below and we will do it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, ask us to correct it, or ask us to
        delete it. Email us and we will respond within 30 days. If you are in
        the UK or EU, you also have the right to complain to your data
        protection authority.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest by our hosting providers.
        Access requires a link sent to your own email address. Every page and
        every API route checks your session before returning anything.
      </p>
      <p>
        We are a small operation in a testing phase. We have not completed an
        external security audit, and you should weigh that when deciding what to
        upload.
      </p>

      <h2>Contact</h2>
      <p>
        Email <strong>privacy@vanthroo.com</strong> for anything on this page,
        including deletion requests.
      </p>

      <hr />
      <p>
        <em>
          This policy describes what the software does, accurately and in plain
          language. It has not been reviewed by a lawyer and is not a substitute
          for legal advice. If you are handling regulated data, take your own
          advice before uploading it.
        </em>
      </p>
    </LegalPage>
  );
}
