import type { Metadata } from "next";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Analyst Studio",
};

/**
 * Honest terms for a closed testing phase. Deliberately short: promising less
 * than the software can currently deliver is the only defensible position while
 * it is being tested.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        <strong>Last updated 3 September 2026.</strong> Analyst Studio is
        operated by VanThroo Technologies. By signing in you agree to these
        terms.
      </p>

      <h2>What this is</h2>
      <p>
        Analyst Studio reads discovery material — transcripts, notes,
        specifications — and extracts the requirements, business rules and
        acceptance criteria in it, each quoted back to its source.
      </p>
      <p>
        It is in <strong>closed testing</strong>. It is offered free, it may
        change or break without notice, and it is not yet a commercial service.
      </p>

      <h2>Your account</h2>
      <p>
        Sign-in is by a one-time link sent to your email address. Anyone with
        access to that inbox can reach your account, so keep it secure. One
        account is for one person; do not share it.
      </p>

      <h2>Your content stays yours</h2>
      <p>
        You keep all rights to the documents you upload and to the requirements
        extracted from them. We claim no ownership and will not use your content
        to develop the product or train anything.
      </p>
      <p>
        You are responsible for having the right to upload what you upload.
        Please read the{" "}
        <a href="/privacy">Privacy Policy</a> before uploading anything
        confidential — in particular, your documents are sent to Anthropic to be
        analysed.
      </p>

      <h2>What the extraction is, and is not</h2>
      <p>
        Extraction is automated and imperfect. It will miss things, and it will
        occasionally record something in a way you would have phrased
        differently. Every requirement carries a verbatim quote from your source
        so you can check it — <strong>please check it</strong>.
      </p>
      <p>
        The output is a draft for a professional to review. It is not legal,
        compliance or regulatory advice, and it should not be relied on as the
        sole basis for a decision. If a requirement matters, verify it against
        the source before acting on it.
      </p>

      <h2>Fair use</h2>
      <p>Do not use Analyst Studio to:</p>
      <ul>
        <li>upload material you have no right to share</li>
        <li>attempt to access another account or another organisation&apos;s data</li>
        <li>probe, scan or overload the service</li>
        <li>break the law</li>
      </ul>
      <p>
        We may suspend an account that does any of these. During testing we may
        also suspend or end access for any reason, with notice where we can give
        it.
      </p>

      <h2>Availability</h2>
      <p>
        There is no uptime guarantee while the product is in testing. Extraction
        depends on a third-party API and can fail or slow down for reasons
        outside our control. Keep your own copy of anything you cannot afford to
        lose.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided as is, without warranties. To the extent the law
        allows, VanThroo Technologies is not liable for indirect or
        consequential loss, or for decisions taken on the basis of extracted
        output that was not verified against its source.
      </p>
      <p>
        Nothing here limits liability for death or personal injury caused by
        negligence, for fraud, or for anything else that cannot lawfully be
        limited.
      </p>

      <h2>Ending it</h2>
      <p>
        You can stop at any time. Ask us to delete your account and we will
        remove it and everything in it. See the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Email <strong>hello@vanthroo.com</strong>.
      </p>

      <hr />
      <p>
        <em>
          These terms are written in plain language for a closed testing phase.
          They have not been reviewed by a lawyer. Before Analyst Studio is
          offered commercially, they should be.
        </em>
      </p>
    </LegalPage>
  );
}
