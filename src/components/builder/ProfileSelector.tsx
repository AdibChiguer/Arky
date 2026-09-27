import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { MAX_PROFILE_NAME_LENGTH } from "../../lib/constants";
import type { WheelProfile } from "../../types/wheel";

type Props = {
  profiles: WheelProfile[];
  selectedId: string;
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => boolean;
  onRename: (id: string, name: string) => boolean;
  onDuplicate: (id: string) => boolean;
  onDelete: (id: string) => boolean;
};

export function ProfileSelector({ profiles, selectedId, activeId, onSelect, onCreate, onRename, onDuplicate, onDelete }: Props) {
  const [nameEditMode, setNameEditMode] = useState<"create" | "rename" | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [name, setName] = useState("");
  const [creationAttempted, setCreationAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const dropdownId = useId();
  const creationErrorId = useId();
  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];
  const editingName = nameEditMode !== null;
  const trimmedName = name.trim();
  const nameValidationError = !trimmedName
    ? "Enter a profile name."
    : Array.from(trimmedName).length > MAX_PROFILE_NAME_LENGTH
      ? `Profile names can contain up to ${MAX_PROFILE_NAME_LENGTH} characters.`
      : profiles.some((profile) => profile.id !== (nameEditMode === "rename" ? selectedId : "") && profile.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())
        ? "A profile with this name already exists."
        : "";
  const visibleCreationError = creationAttempted || (trimmedName && nameValidationError)
    ? nameValidationError
    : "";

  useEffect(() => {
    if (editingName) inputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const frame = requestAnimationFrame(() => optionRefs.current.get(selectedProfile?.id ?? profiles[0]?.id)?.focus());
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
        setDeleteConfirmationOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [dropdownOpen, profiles, selectedProfile?.id]);

  function closeDropdown(returnFocus = false) {
    setDropdownOpen(false);
    setDeleteConfirmationOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function chooseProfile(id: string) {
    if (id !== selectedId) onSelect(id);
    closeDropdown(true);
  }

  function handleOptionKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseProfile(profiles[index].id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown(true);
      return;
    }
    const targetIndex = event.key === "ArrowDown"
      ? Math.min(index + 1, profiles.length - 1)
      : event.key === "ArrowUp"
        ? Math.max(index - 1, 0)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? profiles.length - 1
            : -1;
    if (targetIndex >= 0) {
      event.preventDefault();
      optionRefs.current.get(profiles[targetIndex].id)?.focus();
    }
  }

  function closeNameEditor() {
    setNameEditMode(null);
    setName("");
    setCreationAttempted(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setCreationAttempted(true);
    if (nameValidationError) return;
    const saved = nameEditMode === "rename"
      ? onRename(selectedId, trimmedName)
      : onCreate(trimmedName);
    if (saved) closeNameEditor();
  }

  function startNameEditor(mode: "create" | "rename") {
    setDropdownOpen(false);
    setDeleteConfirmationOpen(false);
    setCreationAttempted(false);
    setName(mode === "rename" ? selectedProfile?.name ?? "" : "");
    setNameEditMode(mode);
  }

  function duplicateSelectedProfile() {
    if (selectedProfile && onDuplicate(selectedProfile.id)) closeDropdown(true);
  }

  function deleteSelectedProfile() {
    if (selectedProfile && onDelete(selectedProfile.id)) closeDropdown(true);
  }

  return <div ref={selectorRef} className="profile-selector" onBlur={(event) => {
    if (dropdownOpen && !event.currentTarget.contains(event.relatedTarget as Node)) {
      setDropdownOpen(false);
      setDeleteConfirmationOpen(false);
    }
  }}>
    <div className="profile-selector-label">Wheel profile</div>
    {editingName ? <form className="profile-selector-row is-creating" onSubmit={submit}>
      <input ref={inputRef} className={`profile-name-input${visibleCreationError ? " has-error" : ""}`} aria-label={nameEditMode === "rename" ? "Rename profile" : "New profile name"} aria-invalid={Boolean(visibleCreationError)} aria-describedby={visibleCreationError ? creationErrorId : undefined} value={name} maxLength={MAX_PROFILE_NAME_LENGTH} placeholder="Profile name" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeNameEditor();
        }
      }} />
      <button className="profile-create-confirm" type="submit" aria-label={nameEditMode === "rename" ? "Confirm profile rename" : "Confirm profile creation"} title={nameEditMode === "rename" ? "Rename profile" : "Create profile"}><Check size={15} /></button>
      <button className="profile-create-cancel" type="button" aria-label={nameEditMode === "rename" ? "Cancel profile rename" : "Cancel profile creation"} title="Cancel" onClick={closeNameEditor}><X size={15} /></button>
    </form> : <div className="profile-selector-row">
      <div className="profile-dropdown">
        <button ref={triggerRef} className={`profile-dropdown-trigger${dropdownOpen ? " is-open" : ""}`} type="button" aria-label="Wheel profile" aria-haspopup="listbox" aria-expanded={dropdownOpen} aria-controls={dropdownId} onClick={() => { setDeleteConfirmationOpen(false); setDropdownOpen((open) => !open); }} onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setDropdownOpen(true);
          } else if (event.key === "Escape" && dropdownOpen) {
            event.preventDefault();
            closeDropdown();
          }
        }}>
          <span>{selectedProfile?.name ?? "Select a profile"}</span>
          <ChevronDown size={14} />
        </button>
        {dropdownOpen && <div id={dropdownId} className="profile-dropdown-menu">
          <div className="profile-dropdown-options" role="listbox" aria-label="Wheel profiles">
            {profiles.map((profile, index) => <button key={profile.id} ref={(node) => {
              if (node) optionRefs.current.set(profile.id, node);
              else optionRefs.current.delete(profile.id);
            }} className={`profile-dropdown-option${profile.id === selectedId ? " is-selected" : ""}`} type="button" role="option" aria-selected={profile.id === selectedId} onClick={() => chooseProfile(profile.id)} onKeyDown={(event) => handleOptionKeyDown(event, index)}>
              <span className="profile-dropdown-option-copy"><strong>{profile.name}</strong>{profile.id === activeId && <small>Active</small>}</span>
              {profile.id === selectedId && <Check size={14} />}
            </button>)}
          </div>
          <div className="profile-dropdown-management">
            {deleteConfirmationOpen ? <div className="profile-delete-confirmation">
              <span>Delete “{selectedProfile?.name}”?</span>
              <div>
                <button className="profile-delete-confirm" type="button" onClick={deleteSelectedProfile}>Delete</button>
                <button className="profile-delete-cancel" type="button" aria-label="Cancel profile deletion" title="Cancel" onClick={() => setDeleteConfirmationOpen(false)}><X size={13} /></button>
              </div>
            </div> : <>
              <span className="profile-management-label">Manage selected</span>
              <div className="profile-management-actions">
                <button type="button" aria-label={`Rename ${selectedProfile?.name ?? "profile"}`} title="Rename profile" onClick={() => startNameEditor("rename")}><Pencil size={13} /></button>
                <button type="button" aria-label={`Duplicate ${selectedProfile?.name ?? "profile"}`} title="Duplicate profile" onClick={duplicateSelectedProfile}><Copy size={13} /></button>
                <button className="is-danger" type="button" aria-label={`Delete ${selectedProfile?.name ?? "profile"}`} title={profiles.length <= 1 ? "Keep at least one profile" : "Delete profile"} disabled={profiles.length <= 1} onClick={() => setDeleteConfirmationOpen(true)}><Trash2 size={13} /></button>
              </div>
            </>}
          </div>
        </div>}
      </div>
      <button className="profile-add-button" type="button" aria-label="Create profile" title="Create profile" onClick={() => startNameEditor("create")}>
        <Plus size={16} />
      </button>
    </div>}
    {visibleCreationError && <div id={creationErrorId} className="profile-create-error" role="alert">{visibleCreationError}</div>}
    {!editingName && selectedId && activeId && selectedId !== activeId && <div className="profile-selector-status">Save to make this profile active.</div>}
  </div>;
}
