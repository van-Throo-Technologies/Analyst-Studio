import type { Metadata } from "next";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Analyst Studio",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are being prepared and are not yet published. Analyst Studio
        is in a closed testing phase and is not offered as a general service.
      </p>
      <p>
        If you need the terms that apply to your use of the product during
        testing, contact VanThroo Technologies directly and they will be provided
        to you.
      </p>
    </LegalPage>
  );
}
