"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  CalendarDays,
  LogOut,
  Mail,
  Navigation,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { cn } from "@/lib/utils"

import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  MAX_INTEREST_SELECTIONS,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  WEATHER_SENSITIVITY_OPTIONS,
  getOptionLabel,
} from "@/lib/auth/profile-options"
import type { AuthResponseBody, AuthUser } from "@/lib/auth/types"

import { DASHBOARD_COPY, createProfileFormState, type ProfileFormState } from "@/app/dashboard/constants"
import { SelectOptionTile, ToggleChip, StatusMetric } from "./ui"

export function SettingsModal({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean
  onClose: () => void
  user: AuthUser
}) {
  const router = useRouter()
  const { language } = useLanguage()
  const { setAuthenticatedUser } = useAuth()
  const copy = DASHBOARD_COPY[language]

  const [form, setForm] = useState<ProfileFormState>(() => createProfileFormState(user))
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

  const weatherSensitivityLabels = useMemo(() => {
    return form.weatherSensitivity.length > 0
      ? form.weatherSensitivity.map((value) => getOptionLabel(WEATHER_SENSITIVITY_OPTIONS, value, language))
      : [copy.noSensitivity]
  }, [copy.noSensitivity, form.weatherSensitivity, language])

  const joinedAtLabel = useMemo(
    () => new Date(user.createdAt).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US"),
    [language, user.createdAt]
  )

  const panelClassName =
    "rounded-[1.5rem] border border-card-border/70 bg-card/65 p-4 backdrop-blur-xl sm:p-5"
  const inputClassName =
    "w-full rounded-[1.2rem] border border-card-border/70 bg-background/80 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-sky-blue/35 focus:ring-2 focus:ring-sky-blue/15"

  const handleToggleInterest = (value: string) => {
    setSaveMessage(null)
    setForm((current) => {
      const exists = current.interestTags.includes(value)
      if (exists) {
        return {
          ...current,
          interestTags: current.interestTags.filter((item) => item !== value),
          interestOther: value === "other" ? "" : current.interestOther,
        }
      }
      if (current.interestTags.length >= MAX_INTEREST_SELECTIONS) {
        setSaveMessage({ type: "error", text: copy.profileHint })
        return current
      }
      return {
        ...current,
        interestTags: [...current.interestTags, value],
      }
    })
  }

  const handleToggleSensitivity = (value: string) => {
    setForm((current) => {
      const exists = current.weatherSensitivity.includes(value)
      return {
        ...current,
        weatherSensitivity: exists
          ? current.weatherSensitivity.filter((item) => item !== value)
          : [...current.weatherSensitivity, value],
      }
    })
  }

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        setSaveMessage({ type: "error", text: data.error ?? copy.saveError })
        return
      }
      setAuthenticatedUser((data as AuthResponseBody).user)
      setSaveMessage({ type: "success", text: copy.saveSuccess })
      router.refresh()
    } catch (error) {
      console.error("Profile save failed:", error)
      setSaveMessage({ type: "error", text: copy.saveError })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteMessage(null)
    setIsDeleting(true)

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmText: deleteConfirm }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDeleteMessage(data.error ?? copy.deleteError)
        return
      }
      setDeleteMessage(copy.deleteSuccess)
      setAuthenticatedUser(null)
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Account deletion failed:", error)
      setDeleteMessage(copy.deleteError)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setAuthenticatedUser(null)
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-card-border bg-background/95 px-5 py-6 shadow-2xl backdrop-blur-2xl sm:px-8 sm:py-8 custom-scrollbar"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,111,228,0.18),transparent_52%),radial-gradient(circle_at_16%_24%,rgba(11,125,113,0.14),transparent_44%)]" />

            <div className="relative z-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-blue/20 bg-sky-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-blue">
                    <Sparkles className="size-3.5" />
                    {copy.accountTitle}
                  </span>
                  <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{copy.profileTitle}</h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.profileDescription}</p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full border border-card-border/70 bg-card/70 p-2.5 text-muted-foreground transition hover:border-sky-blue/25 hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.3rem] border border-card-border/70 bg-card/70 p-4">
                  <div className="mb-2 inline-flex rounded-full bg-sky-blue/12 p-2 text-sky-blue">
                    <Mail className="size-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.email}</p>
                  <p className="mt-2 break-all text-sm font-semibold text-foreground">{user.email}</p>
                </div>
                <div className="rounded-[1.3rem] border border-card-border/70 bg-card/70 p-4">
                  <div className="mb-2 inline-flex rounded-full bg-sky-blue/12 p-2 text-sky-blue">
                    <CalendarDays className="size-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.joined}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{joinedAtLabel}</p>
                </div>
                <div className="rounded-[1.3rem] border border-card-border/70 bg-card/70 p-4">
                  <div className="mb-2 inline-flex rounded-full bg-success/12 p-2 text-success">
                    <BadgeCheck className="size-4" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{copy.accountStatus}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{copy.active}</p>
                </div>
              </div>

              <div className="space-y-10 pb-10">
                <section>
                  <form className="space-y-5" onSubmit={handleSaveProfile}>
                    <div className={panelClassName}>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                          {copy.name} · {copy.nickname}
                        </p>
                        <span className="text-[11px] font-bold text-muted-foreground/70">{copy.nicknameHint}</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                          <label className="text-sm font-black text-foreground">{copy.name}</label>
                          <input
                            type="text"
                            value={form.displayName}
                            onChange={(e) => setForm((curr) => ({ ...curr, displayName: e.target.value }))}
                            className={inputClassName}
                          />
                        </div>
                        <div className="space-y-2 sm:min-w-[14rem]">
                          <label className="text-sm font-black text-foreground">{copy.nickname}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={form.nickname}
                              onChange={(e) => setForm((curr) => ({ ...curr, nickname: e.target.value.slice(0, 16) }))}
                              className={cn(inputClassName, "flex-1")}
                            />
                            {user.nicknameTag && (
                              <span className="shrink-0 rounded-[1.2rem] border border-card-border/70 bg-background/80 px-3 py-3 text-sm font-black tracking-wider text-muted-foreground">
                                #{user.nicknameTag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={panelClassName}>
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-sm font-black text-foreground">{copy.age}</label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {AGE_BAND_OPTIONS.map((option) => (
                              <SelectOptionTile
                                key={option.value}
                                selected={form.ageBand === option.value}
                                label={option.label[language]}
                                onClick={() => setForm((curr) => ({ ...curr, ageBand: option.value }))}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm font-black text-foreground">{copy.region}</label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PRIMARY_REGION_OPTIONS.map((option) => (
                              <SelectOptionTile
                                key={option.value}
                                selected={form.primaryRegion === option.value}
                                label={option.label[language]}
                                onClick={() => setForm((curr) => ({ ...curr, primaryRegion: option.value }))}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={panelClassName}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <label className="text-sm font-black text-foreground">{copy.interests}</label>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {form.interestTags.length}/{MAX_INTEREST_SELECTIONS}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {INTEREST_OPTIONS.map((option) => (
                          <ToggleChip
                            key={option.value}
                            selected={form.interestTags.includes(option.value)}
                            label={option.label[language]}
                            onClick={() => handleToggleInterest(option.value)}
                          />
                        ))}
                      </div>
                      {form.interestTags.includes("other") ? (
                        <input
                          type="text"
                          value={form.interestOther}
                          onChange={(e) => setForm((curr) => ({ ...curr, interestOther: e.target.value }))}
                          placeholder={copy.otherInterestPlaceholder}
                          className={cn(inputClassName, "mt-3")}
                        />
                      ) : null}
                    </div>

                    <div className={panelClassName}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-sm font-black text-foreground">{copy.time}</label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {TIME_SLOT_OPTIONS.map((option) => (
                              <SelectOptionTile
                                key={option.value}
                                selected={form.preferredTimeSlot === option.value}
                                label={option.label[language]}
                                onClick={() => setForm((curr) => ({ ...curr, preferredTimeSlot: option.value }))}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm font-black text-foreground">{copy.sensitivity}</label>
                          <div className="flex flex-wrap gap-2">
                            {WEATHER_SENSITIVITY_OPTIONS.map((option) => (
                              <ToggleChip
                                key={option.value}
                                selected={form.weatherSensitivity.includes(option.value)}
                                label={option.label[language]}
                                onClick={() => handleToggleSensitivity(option.value)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={panelClassName}>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={form.marketingAccepted}
                            onChange={(e) => setForm((curr) => ({ ...curr, marketingAccepted: e.target.checked }))}
                            className="mt-1 size-4 rounded border-card-border accent-sky-blue"
                          />
                          <span>{copy.marketing}</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-[1.2rem] border border-card-border/70 bg-background/70 px-4 py-3 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={form.analyticsAccepted}
                            onChange={(e) => setForm((curr) => ({ ...curr, analyticsAccepted: e.target.checked }))}
                            className="mt-1 size-4 rounded border-card-border accent-sky-blue"
                          />
                          <span>
                            {copy.analytics}
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{copy.analyticsHint}</span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <AnimatePresence>
                      {saveMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className={cn(
                            "overflow-hidden rounded-[1.3rem] border px-4 text-sm font-semibold",
                            saveMessage.type === "success"
                              ? "border-success/20 bg-success/10 py-3 text-success"
                              : "border-danger/20 bg-danger/10 py-3 text-danger"
                          )}
                        >
                          {saveMessage.text}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ShimmerButton
                      type="submit"
                      className="w-full rounded-[1.4rem] py-4 text-base font-black"
                      disabled={isSaving}
                    >
                      {isSaving ? "..." : copy.saveAction}
                    </ShimmerButton>
                  </form>
                </section>

                <section className={panelClassName}>
                  <div className="mb-5 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                      {copy.accountDescription}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">{weatherSensitivityLabels.join(" · ")}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatusMetric label={copy.accountStatus} value={copy.active} meta={copy.dashboardNav} />
                    <StatusMetric label={copy.joined} value={joinedAtLabel} />
                    <StatusMetric label={copy.sensitivity} value={weatherSensitivityLabels.join(" · ")} />
                    <StatusMetric label={copy.analytics} value={user.analyticsAccepted ? copy.yes : copy.no} />
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-card-border/70 bg-card/60 px-4 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                    >
                      <LogOut className="size-4" />
                      {copy.logoutAction}
                    </button>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-card-border/70 bg-card/60 px-4 py-3 text-sm font-black text-foreground transition hover:border-sky-blue/25 hover:text-sky-blue"
                    >
                      <Navigation className="size-4" />
                      {copy.backHome}
                    </Link>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-danger/20 bg-danger/5 p-5">
                  <div className="mb-5 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-danger/80">
                      {copy.dangerTitle}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy.dangerDescription}</p>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder={copy.deletePlaceholder}
                      className="w-full rounded-[1.3rem] border border-danger/20 bg-background/80 px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-danger/40"
                    />
                    {deleteMessage && (
                      <div className="rounded-[1.3rem] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                        {deleteMessage}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      disabled={isDeleting || deleteConfirm !== "DELETE"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[1.3rem] border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-black text-danger transition hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                      {isDeleting ? "..." : copy.deleteAction}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
