import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../theme/ThemeToggle";

const ALL_SPORTS = [
  "Football", "Basketball", "Padel", "Tennis", "Volleyball", "Running", "Cycling",
  "Table Tennis", "Badminton", "Swimming", "Golf", "Boxing", "MMA", "Climbing", "Skate",
  "Rugby", "Cricket", "Baseball", "Hiking", "Rowing", "Handball", "Water Polo", "Squash",
];

const RESERVED = new Set(["admin", "support", "help", "root", "owner"]);
const TAKEN_DEMO = new Set(["mazenhachem", "playconnect", "player1"]); // simulate server



const usernameRegex = /^(?![._])(?!.*[._]{2})[a-z0-9._]{3,20}(?<![._])$/;

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}


async function checkUsernameAvailability(u) {
  await new Promise(r => setTimeout(r, 450)); // latency
  if (!usernameRegex.test(u)) return { ok: false, reason: "invalid" };
  if (RESERVED.has(u)) return { ok: false, reason: "reserved" };
  if (TAKEN_DEMO.has(u)) return { ok: false, reason: "taken" };
  return { ok: true };
}

function suggestUsernames(name, base) {
  const baseSlug = (base || (name || "").toLowerCase().replace(/\s+/g, "")).replace(/[^a-z0-9]/g, "");
  if (!baseSlug) return [];
  const tail = Math.floor(Math.random() * 90 + 10); // 2 digits
  const options = [
    baseSlug,
    `${baseSlug}_${tail}`,
    `${baseSlug}.${tail}`,
    `${baseSlug.slice(0, Math.min(baseSlug.length, 8))}${tail}`,
  ];
  return Array.from(new Set(options)).slice(0, 3);
}

export default function ProfileCreation() {

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [sports, setSports] = useState([]);
  const [sportQuery, setSportQuery] = useState("");


  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);


  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState("player");
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [userDetails, setUserDetails] = useState(null);


  const debouncedUsername = useDebounced(username, 400);
  const [uStatus, setUStatus] = useState/** @type {"idle"|"checking"|"ok"|"invalid"|"reserved"|"taken"} */("idle");


  const initials = useMemo(() => {
    const t = name.trim();
    if (!t) return "??";
    return t
      .split(/\s+/)
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target.result);
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarFile(null);
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }


  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  useEffect(() => {
    const draft = localStorage.getItem("pc_onboarding_draft");
    if (draft) {
      try {
        const d = JSON.parse(draft);
        setName(d.name ?? "");
        setUsername(d.username ?? "");
        setBio(d.bio ?? "");
        setSports(Array.isArray(d.sports) ? d.sports.slice(0, 5) : []);
      } catch { }
    }
    // seed from registration if no draft name
    const seedRaw = localStorage.getItem("onboarding_seed");
    if (!name && seedRaw) {
      try {
        const seed = JSON.parse(seedRaw);
        const full = [seed.first_name, seed.last_name].filter(Boolean).join(" ").trim();
        if (full) setName(full);
      } catch { }
    }
    setHasLoadedDraft(true);
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "pc_onboarding_draft",
      JSON.stringify({ name, username, bio, sports })
    );
  }, [name, username, bio, sports]);


  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Load user details required by backend (first_name, last_name, age)
  useEffect(() => {
    let cancelled = false;
    async function loadUserDetails() {
      // allow proceeding without auth by using onboarding seed
      const seedRaw = localStorage.getItem("onboarding_seed");
      const seed = seedRaw ? (() => { try { return JSON.parse(seedRaw); } catch { return null; } })() : null;
      const effectiveUserId = (isAuthenticated && user?.user_id) ? user.user_id : (seed?.user_id ?? null);
      if (!effectiveUserId) return;
      // If we already have details, skip
      if (userDetails?.user_id === effectiveUserId) return;
      try {
        const res = await fetch("http://127.0.0.1:8000/users");
        if (!res.ok) return;
        const all = await res.json();
        const me = all.find((u) => u.user_id === effectiveUserId);
        if (!cancelled && me) {
          setUserDetails(me);
          // Pre-fill name only once when there's no draft/name yet; prefer auth names if present
          const authFull = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
          const fetchedFull = [me.first_name, me.last_name].filter(Boolean).join(" ").trim();
          const seedFull = [seed?.first_name, seed?.last_name].filter(Boolean).join(" ").trim();
          const full = authFull || fetchedFull;
          if (full && hasLoadedDraft && !name) setName(full);
        }
      } catch {
        // ignore
      }
    }
    loadUserDetails();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, name, userDetails, hasLoadedDraft]);


  useEffect(() => {
    if (!debouncedUsername) {
      setUStatus("idle");
      return;
    }
    setUStatus("checking");
    let cancelled = false;
    checkUsernameAvailability(debouncedUsername).then((res) => {
      if (cancelled) return;
      if (res.ok) setUStatus("ok");
      else setUStatus(res.reason); // invalid|reserved|taken
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedUsername]);


  const nameOk = name.trim().length >= 2 && name.trim().length <= 60;
  const usernameOk = uStatus === "ok";
  const sportsOk = sports.length >= 1;
  const bioOk = bio.length <= 160;
  const canSave = nameOk && usernameOk && sportsOk && bioOk && !saving;

  const completion = Math.round(
    (Number(nameOk) + Number(usernameOk) + Number(sportsOk) + Number(bioOk)) / 4 * 100
  );


  const filteredSports = useMemo(() => {
    const q = sportQuery.trim().toLowerCase();
    if (!q) return ALL_SPORTS;
    return ALL_SPORTS.filter(s => s.toLowerCase().includes(q));
  }, [sportQuery]);

  const toggleSport = (s) =>
    setSports((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : prev.length < 5
          ? [...prev, s]
          : prev
    );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);


  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      // Determine user_id from auth or onboarding seed
      const seedRaw = localStorage.getItem("onboarding_seed");
      const seed = seedRaw ? (() => { try { return JSON.parse(seedRaw); } catch { return null; } })() : null;
      const effectiveUserId = (isAuthenticated && user?.user_id) ? user.user_id : (seed?.user_id ?? null);
      if (!effectiveUserId) throw new Error("Missing user id for profile creation.");

      // Ensure we have required backend fields
      const first_name = userDetails?.first_name || "";
      const last_name = userDetails?.last_name || "";
      const age = typeof userDetails?.age === "number" ? userDetails.age : undefined;

      if (!first_name || !last_name || typeof age !== "number") {
        // Try one last fetch if missing
        try {
          const res = await fetch("http://127.0.0.1:8000/users");
          if (res.ok) {
            const all = await res.json();
            const me = all.find((u) => u.user_id === user.user_id);
            if (me) {
              setUserDetails(me);
            }
          }
        } catch { }
      }

      const effective = userDetails || {};
      const payload = {
        // backend requires these even if not shown in UI
        first_name: effective.first_name || first_name || "",
        last_name: effective.last_name || last_name || "",
        age: typeof effective.age === "number" ? effective.age : (typeof age === "number" ? age : 0),
        favorite_sport: sports[0] || "",
        bio,
        avatar_url: avatarUrl || "",
        role,
      };
      const url = `http://127.0.0.1:8000/profile-creation?user_id=${encodeURIComponent(effectiveUserId)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Failed to save profile";
        try {
          const data = await res.json();
          msg = data?.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : msg;
        } catch {
          const text = await res.text();
          if (text) msg = text;
        }
        throw new Error(msg);
      }
      setToast("Profile saved successfully!");
      localStorage.removeItem("pc_onboarding_draft");
      localStorage.removeItem("onboarding_seed");
      navigate("/dashboard");
    } catch (e) {
      setError(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };
  const previewSports = sports.length ? sports : ["Padel", "Football"];
  const previewVisible = previewSports.slice(0, 2);
  const previewHidden = Math.max(0, previewSports.length - 2);
  return (
    <main className="min-h-screen bg-[rgb(var(--pc-bg))] text-neutral-900 dark:text-white relative overflow-hidden transition-colors duration-300">

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 0 0",
        }}
      />

      {/* Background patterns */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15] transition-opacity duration-500"
        style={{
          backgroundImage:
            "linear-gradient(var(--pc-grid, rgba(0,0,0,0.05)) 1px, transparent 1px), linear-gradient(90deg, var(--pc-grid, rgba(0,0,0,0.05)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Gradient glow layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 20% 0%, var(--pc-g1, rgba(167,139,250,0.18)), transparent 60%), radial-gradient(600px 300px at 80% 100%, var(--pc-g2, rgba(244,114,182,0.14)), transparent 55%)",
        }}
      />

      <div className="px-4 py-4 flex items-center justify-between">
        {/* Step indicators (left side) */}
        <ol className="flex items-center gap-2">
          {[
            { key: 'name', label: 'Name', done: nameOk },
            { key: 'username', label: 'Username', done: usernameOk },
            { key: 'sports', label: 'Sports', done: sportsOk },
            { key: 'bio', label: 'Bio', done: bioOk },
          ].map((step, idx, arr) => (
            <li key={step.key} className="flex items-center gap-2">
              <div
                className={classNames(
                  'h-6 w-6 rounded-full grid place-items-center text-[11px] font-medium transition-colors duration-300',
                  step.done
                    ? 'bg-violet-500 text-white'
                    : 'bg-neutral-200 dark:bg-white/15 text-neutral-800 dark:text-white/70 border border-neutral-300 dark:border-white/25'
                )}
                title={step.label}
              >
                {step.done ? (
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.9a1 1 0 111.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>

              {/* Step Label */}
              <span className="text-xs text-neutral-700 dark:text-white/90 min-w-[64px] transition-colors duration-300">
                {step.label}
              </span>

              {/* Connecting line */}
              {idx < arr.length - 1 && (
                <div
                  className="mx-1 h-px w-10 bg-neutral-300 dark:bg-white/30 transition-colors duration-300"
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>

        {/* Theme toggle (right side) */}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>



      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 id="profilecreationtheme" className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            Complete your profile
          </h1>
          <p className="mt-1 text-sm text-neutral-400">Make it easier to find games you’ll love.</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">

          <section className="space-y-6">
            {/* Name */}
            <div>
              <label id="profilecreationtheme" className="block text-sm mb-1">Full name</label>
              <div className="relative">
                <input id="inputUsername"
                  className={classNames(
                    "w-full rounded-lg bg-white/80 dark:bg-neutral-950/70 border px-3 py-3 outline-none shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                    nameOk
                      ? "border-neutral-800"
                      : "border-rose-500"
                  )}
                  placeholder="e.g., Lionel Messi"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
                <span className="absolute right-2 top-3 text-xs text-neutral-500">
                  {name.trim().length}/60
                </span>
              </div>
              {!nameOk && (
                <p className="mt-1 text-xs text-rose-400">Use 2–60 characters.</p>
              )}
            </div>


            <div>
              <label id="profilecreationtheme" className="block text-sm mb-1">Username</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-base select-none">@</span>
                <input id="inputUsername"
                  className={classNames(
                    "w-full rounded-lg bg-white/80 dark:bg-neutral-950/70 border pl-7 pr-9 py-3 outline-none shadow-sm focus:ring-2 focus:ring-violet-500",
                    uStatus === "ok"
                      ? "border-neutral-800"
                      : uStatus === "idle" || uStatus === "checking"
                        ? "border-neutral-800"
                        : "border-rose-500"
                  )}
                  placeholder="username"
                  value={username}
                  maxLength={20}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                />

                <div className="pointer-events-none absolute right-2 top-0 h-full flex items-center">
                  {uStatus === "checking" && (
                    <svg className="h-4 w-4 animate-spin text-neutral-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  {uStatus === "ok" && (
                    <svg className="h-5 w-5 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.9a1 1 0 111.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {["invalid", "reserved", "taken"].includes(uStatus) && (
                    <svg className="h-5 w-5 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5h2v2H9v-2zm0-8h2v6H9V5z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                3–20 chars. lowercase letters, numbers, dot, underscore. No leading/trailing or double `.`/`_`.
              </p>

              {["invalid", "reserved", "taken"].includes(uStatus) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                  Try:{" "}
                  {suggestUsernames(name, username).map((s, i) => (
                    <button
                      key={s}
                      className="underline underline-offset-2 decoration-neutral-600 hover:text-neutral-200"
                      onClick={() => setUsername(s)}
                      type="button"
                    >
                      @{s}{i < 2 ? "," : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>


            <div>
              <label id="profilecreationtheme" className="block text-sm mb-1">Profile picture</label>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-full p-[2px]"
                  style={{ background: 'conic-gradient(from 180deg at 50% 50%, #a78bfa, #f472b6, #f59e0b, #a78bfa)' }}>
                  <div className="h-full w-full rounded-full bg-black/30 grid place-items-center text-white/90 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <span className="text-sm font-medium">{initials}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-medium"><p>Upload or drag a square image</p></div>
                  <div className="text-xs text-white/70 mb-1">PNG/JPG • Min 256×256 • Shows on your games</div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 text-xs font-medium shadow-sm transition"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    >
                      {avatarUrl ? "Change photo" : "Upload photo"}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        className="rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 px-3 py-1.5 text-xs font-medium shadow-sm transition"
                        onClick={removeAvatar}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label id="profilecreationtheme" className="block text-sm mb-1">Bio</label>
              <div className="relative">
                <textarea id="inputUsername"
                  rows={3}
                  className={classNames(
                    "w-full rounded-lg bg-white/80 dark:bg-neutral-950/70 border px-3 py-3 outline-none shadow-sm focus:ring-2 focus:ring-violet-500",
                    bioOk ? "border-neutral-800" : "border-rose-500"
                  )}
                  placeholder="Tell others about you (max 160 chars)"
                  value={bio}
                  maxLength={160}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                />
                <span className="absolute right-2 bottom-2 text-xs text-neutral-500">
                  {160 - bio.length} left
                </span>
              </div>
            </div>

            {/* Role */}
            <div>
              <label id="profilecreationtheme" className="block text-sm mb-1">Role</label>
              <select id="inputUsername"
                className="w-full rounded-lg bg-white/80 dark:bg-neutral-950/70 border border-neutral-800 px-3 py-3 outline-none shadow-sm focus:ring-2 focus:ring-violet-500"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="player">Player</option>
                <option value="coach">Coach</option>
                <option value="organizer">Organizer</option>
              </select>
            </div>

            {/* Sports */}
            <div>
              <div className="flex items-end justify-between gap-3">
                <label id="profilecreationtheme" className="block text-sm">Follow sports (pick up to 5)</label>
                <div className="w-48">
                  <input id="inputUsername"
                    className="w-full rounded-lg bg-white/80 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 px-3 py-1.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    placeholder="Search sport"
                    value={sportQuery}
                    onChange={(e) => setSportQuery(e.target.value)}
                  />

                </div>
              </div>

              <div className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
                {filteredSports.map((s) => {
                  const selected = sports.includes(s);
                  const disabled = !selected && sports.length >= 5;
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSport(s)}
                      disabled={disabled}
                      title={disabled ? "Limit reached (5)" : ""}
                      className={classNames(
                        // reset native button + smooth interactions
                        "appearance-none rounded-full border px-3 py-1.5 text-sm select-none",
                        "transition-colors transition-transform transition-shadow duration-150",
                        "focus-visible:outline-none active:scale-[0.98]",
                        // states
                        selected
                          ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-400 active:text-white focus-visible:ring-2 focus-visible:ring-violet-400 ring-2 ring-violet-400 ring-offset-2 ring-offset-neutral-950 shadow-lg shadow-violet-500/30"
                          : "bg-white/10 border-white/20 text-white/90 hover:bg-white/15 hover:border-white/40 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/30",
                        // cap state
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {selected && (
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.9a1 1 0 111.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>{s}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {!sportsOk && (
                <p className="mt-1 text-xs text-rose-400">Pick at least one sport.</p>
              )}
            </div>

            {/* Actions — mobile sticky */}
            <div className="lg:hidden sticky bottom-0 left-0 right-0 -mx-4 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur-sm px-4 py-4">
              <div className="flex gap-3">
                <button id="profilecreationtheme"
                  onClick={onSave}
                  disabled={!canSave}
                  className={
                    canSave
                      ? "appearance-none rounded-xl bg-violet-500 text-white px-4 py-2 font-medium transition-colors transition-transform duration-150 hover:bg-violet-400 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                      : "appearance-none rounded-xl bg-neutral-800/80 text-neutral-500 px-4 py-2 font-medium cursor-not-allowed"
                  }
                >
                  {saving ? "Saving…" : "Save & Continue"}
                </button>
                <button
                  type="button" id="profilecreationtheme"
                  className="appearance-none rounded-xl px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100
 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                >
                  Skip for now
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs text-rose-400">{error}</p>
              )}
            </div>

            {/* Actions — desktop inline */}
            <div className="hidden lg:flex gap-3 pt-2">
              <button id="profilecreationtheme"
                onClick={onSave}
                disabled={!canSave}
                className={
                  canSave
                    ? "appearance-none rounded-xl bg-violet-500 text-white px-4 py-2 font-medium transition-colors transition-transform duration-150 hover:bg-violet-400 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                    : "appearance-none rounded-xl bg-neutral-800/80 text-neutral-500 px-4 py-2 font-medium cursor-not-allowed"
                }
              >
                {saving ? "Saving…" : "Save & Continue"}
              </button>
              <button
                type="button" id="profilecreationtheme"
                className="appearance-none rounded-xl px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100
 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                Skip for now
              </button>
              {error && (
                <p className="self-center text-xs text-rose-400">{error}</p>
              )}
            </div>
          </section>

          {/* --------- RIGHT: PREVIEW --------- */}
          <aside className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/80 p-4 max-h-60 overflow-hidden transition-colors duration-300">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <div className="font-medium tracking-tight truncate leading-snug max-w-[200px] sm:max-w-[240px]">
                  {name || "Your Name"}
                </div>
                <div className="text-neutral-400 text-xs truncate leading-snug max-w-[200px] sm:max-w-[240px]">
                  @{username || "username"}
                </div>
              </div>
            </div>

            <p
              id="biography" className="mt-3 text-sm text-neutral-300 leading-snug whitespace-pre-wrap break-words clamp-2"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {bio || "Your short bio will appear here."}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {previewVisible.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200"
                >
                  {s}
                </span>
              ))}
              {previewHidden > 0 && (
                <span className="rounded-full bg-neutral-800/70 px-2 py-0.5 text-[11px] text-neutral-300">
                  +{previewHidden} more
                </span>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-neutral-100 shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
