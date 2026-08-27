import type { Metadata } from "next";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Analyst Studio",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy is being prepared and is not yet published. Analyst Studio is
        in a closed testing phase and is not offered as a general service.
      </p>
      <p>
        Analyst Studio stores the email address you sign in with, and any
        transcripts and requirements you create in the product. If you would like
        your account and its data removed, contact VanThroo Technologies and it
        will be deleted.
      </p>
    </LegalPage>
  );
}
