"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { AGE_BANDS, MAX_CHILD_PROFILES_PER_ACCOUNT, type AgeBand, type ChildProfile } from "@/lib/kids/types";
import { AVATAR_CHOICES, avatarEmoji } from "@/lib/kids/avatars";
import {
  createChildAction,
  deleteChildAction,
  removePinAction,
  resetPinAction,
  setupPinAction,
  updateChildAction,
} from "./actions";

interface Props {
  initialChildren: ChildProfile[];
  pinIsSetUp: boolean;
}

const AGE_BAND_LABEL: Record<AgeBand, string> = {
  "4-6": "4–6 years",
  "7-10": "7–10 years",
  "11-14": "11–14 years",
};

export default function ParentDashboardClient({ initialChildren, pinIsSetUp }: Props) {
  const router = useRouter();

  // No local copy of the list: router.refresh() re-runs page.tsx's DB query
  // and passes a fresh initialChildren prop straight through, which is all
  // this component ever reads from. Syncing a local copy via useEffect would
  // just be a second source of truth for the same data one render late.
  const children = initialChildren;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text)]">Kids Mode</h1>
          <p className="text-sm text-[var(--text-dim)]">Manage child profiles and your PIN.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-bold text-[var(--secondary)]">
          Back to FORGE
        </Link>
      </header>

      <ChildList
        childProfiles={children}
        onChanged={() => router.refresh()}
      />

      {children.length < MAX_CHILD_PROFILES_PER_ACCOUNT && (
        <AddChildForm onCreated={() => router.refresh()} />
      )}

      <PinSection pinIsSetUp={pinIsSetUp} onChanged={() => router.refresh()} />
    </div>
  );
}

function ChildList({ childProfiles, onChanged }: { childProfiles: ChildProfile[]; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (childProfiles.length === 0) {
    return (
      <Card className="p-4 text-sm text-[var(--text-dim)]">
        No child profiles yet. Add one below to try Kids Mode.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {childProfiles.map((child) =>
        editingId === child.id ? (
          <EditChildForm key={child.id} child={child} onDone={() => setEditingId(null)} onSaved={onChanged} />
        ) : (
          <ChildRow key={child.id} child={child} onEdit={() => setEditingId(child.id)} onChanged={onChanged} />
        ),
      )}
    </div>
  );
}

function ChildRow({
  child,
  onEdit,
  onChanged,
}: {
  child: ChildProfile;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteChildAction(child.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    onChanged();
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hi)] text-2xl">
          {avatarEmoji(child.avatarId)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[var(--text)]">{child.displayName}</p>
          <p className="text-xs text-[var(--text-faint)]">{AGE_BAND_LABEL[child.ageBand]}</p>
        </div>
        <Link href={`/kids/${child.childIndex}`}>
          <Button variant="primary" className="px-3 py-2 text-xs">
            Start
          </Button>
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <button type="button" onClick={onEdit} className="font-bold text-[var(--secondary)]">
          Edit
        </button>
        <span className="text-[var(--text-faint)]">·</span>
        {confirming ? (
          <>
            <span className="text-[var(--text-dim)]">Delete {child.displayName} and all their activity?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="font-bold text-[var(--rose)] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-[var(--text-faint)]">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="font-bold text-[var(--rose)]">
            Delete
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <Label>Avatar</Label>
      <div className="grid grid-cols-6 gap-2">
        {AVATAR_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChange(choice.id)}
            aria-pressed={value === choice.id}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${
              value === choice.id ? "bg-[var(--surface-hi)] ring-2 ring-[var(--secondary)]" : "bg-[var(--bg-2)]"
            }`}
          >
            {choice.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddChildForm({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>("7-10");
  const [avatarId, setAvatarId] = useState("animal-1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createChildAction({ displayName, ageBand, avatarId });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDisplayName("");
    setAgeBand("7-10");
    setAvatarId("animal-1");
    onCreated();
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-bold text-[var(--text)]">Add a child</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="childName">Name</Label>
          <Input
            id="childName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First name or nickname"
            required
          />
        </div>
        <div>
          <Label htmlFor="childAgeBand">Age band</Label>
          <Select id="childAgeBand" value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)}>
            {AGE_BANDS.map((band) => (
              <option key={band} value={band}>
                {AGE_BAND_LABEL[band]}
              </option>
            ))}
          </Select>
        </div>
        <AvatarPicker value={avatarId} onChange={setAvatarId} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" disabled={saving} className="w-full justify-center">
          {saving ? "Adding…" : "Add child"}
        </Button>
      </form>
    </Card>
  );
}

function EditChildForm({
  child,
  onDone,
  onSaved,
}: {
  child: ChildProfile;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(child.displayName);
  const [ageBand, setAgeBand] = useState<AgeBand>(child.ageBand);
  const [avatarId, setAvatarId] = useState(child.avatarId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateChildAction({ id: child.id, displayName, ageBand, avatarId });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onDone();
  }

  return (
    <Card className="space-y-3 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor={`editName-${child.id}`}>Name</Label>
          <Input id={`editName-${child.id}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor={`editAgeBand-${child.id}`}>Age band</Label>
          <Select
            id={`editAgeBand-${child.id}`}
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value as AgeBand)}
          >
            {AGE_BANDS.map((band) => (
              <option key={band} value={band}>
                {AGE_BAND_LABEL[band]}
              </option>
            ))}
          </Select>
        </div>
        <AvatarPicker value={avatarId} onChange={setAvatarId} />
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving} className="flex-1 justify-center">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onDone} className="flex-1 justify-center">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PinSection({ pinIsSetUp, onChanged }: { pinIsSetUp: boolean; onChanged: () => void }) {
  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-bold text-[var(--text)]">Parent PIN</h2>
        <p className="text-xs text-[var(--text-faint)]">
          A quick way to get back here after handing the phone to a child — not a substitute for your account
          password. Anyone signed into your account can always reach these settings.
        </p>
      </div>
      {pinIsSetUp ? <ChangePinForm onChanged={onChanged} /> : <SetupPinForm onChanged={onChanged} />}
    </Card>
  );
}

function SetupPinForm({ onChanged }: { onChanged: () => void }) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await setupPinAction(pin);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPin("");
    onChanged();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="newPin">4–6 digit PIN</Label>
        <Input
          id="newPin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={6}
          required
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" variant="primary" disabled={saving} className="w-full justify-center">
        {saving ? "Saving…" : "Set up PIN"}
      </Button>
    </form>
  );
}

function ChangePinForm({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<"idle" | "reset" | "remove">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await resetPinAction(currentPassword, newPin);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPin("");
    setMode("idle");
    onChanged();
  }

  async function handleRemove(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await removePinAction(currentPassword);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setMode("idle");
    onChanged();
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setMode("reset")} className="font-bold text-[var(--secondary)]">
          Change PIN
        </button>
        <span className="text-[var(--text-faint)]">·</span>
        <button type="button" onClick={() => setMode("remove")} className="font-bold text-[var(--rose)]">
          Remove PIN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={mode === "reset" ? handleReset : handleRemove} className="space-y-3">
      <div>
        <Label htmlFor="currentPassword">Current account password</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      {mode === "reset" && (
        <div>
          <Label htmlFor="newPinReset">New 4–6 digit PIN</Label>
          <Input
            id="newPinReset"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            maxLength={6}
            required
          />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={saving} className="flex-1 justify-center">
          {saving ? "Saving…" : mode === "reset" ? "Save new PIN" : "Remove PIN"}
        </Button>
        <Button type="button" onClick={() => setMode("idle")} className="flex-1 justify-center">
          Cancel
        </Button>
      </div>
    </form>
  );
}
