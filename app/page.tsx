import { redirect } from "next/navigation";

// The workspace lives at /projects. The root just forwards there — including
// for signed-out visitors, who /projects then bounces on to /signin.
export default function Home() {
  redirect("/projects");
}
