import { redirect } from "next/navigation";

/** The fridge list is the app's home. Send the bare root there. */
export default function Home() {
  redirect("/fridges");
}
