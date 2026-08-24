import { redirect } from "next/navigation"

/**
 * `/account` is a compatibility alias. Profile editing and account actions
 * live on `/dashboard` (settings modal). Keep this redirect so old bookmarks
 * and emails do not 404.
 */
export default function AccountPage() {
  redirect("/dashboard")
}
