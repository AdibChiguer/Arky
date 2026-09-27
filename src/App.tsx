import { AppHeader } from "./components/builder/AppHeader";
import { AppearanceSettings } from "./components/builder/AppearanceSettings";
import { BackupRestoreSettings } from "./components/builder/BackupRestoreSettings";
import { EmptyState } from "./components/builder/EmptyState";
import { LivePreview } from "./components/builder/LivePreview";
import { SegmentEditor } from "./components/builder/SegmentEditor";
import { SegmentSidebar } from "./components/builder/SegmentSidebar";
import { SettingsPanel } from "./components/builder/SettingsPanel";
import { StartupSettings } from "./components/builder/StartupSettings";
import { WheelBehaviorSettings } from "./components/builder/WheelBehaviorSettings";
import { ToastHost } from "./components/common/ToastHost";
import { useBuilder } from "./hooks/useBuilder";
import { useShortcutRecorder } from "./hooks/useShortcutRecorder";
import { notify } from "./lib/notifications";
import { defaultShortcut } from "./lib/shortcuts";
import "./App.css";

function App() {
  const builder = useBuilder();
  const recorder = useShortcutRecorder(builder.shortcut, builder.setShortcut, builder.platform);
  const selected = builder.selection?.segment;

  function restoreShortcut() {
    builder.setShortcut(defaultShortcut(builder.platform));
    recorder.stop();
    notify({ tone: "info", message: "Default shortcut restored. Save to activate it." });
  }

  return <div className="builder-shell">
    <ToastHost />
    <AppHeader view={builder.view} onViewChange={builder.setView} />
    <div className="builder-layout">
      <SegmentSidebar profiles={builder.profiles} profileId={builder.editingProfileId} activeProfileId={builder.activeProfileId} segments={builder.segments} selectedId={builder.selectedId} draggedId={builder.draggedId} onProfileSelect={builder.selectProfile} onProfileCreate={builder.createProfile} onProfileRename={builder.renameProfile} onProfileDuplicate={builder.duplicateProfile} onProfileDelete={builder.deleteProfile} onSelect={builder.select} onDragChange={builder.setDraggedId} onDrop={builder.drop} onMove={builder.move} onAddAction={builder.addAction} onAddFolder={builder.addFolder} />
      <main className="builder-main">
        {builder.view === "actions" ? selected ? <SegmentEditor
          segment={selected}
          index={builder.selection?.index ?? -1}
          parent={builder.selection?.parent}
          quickKeyError={builder.quickKeyError}
          platform={builder.platform}
          iconPickerOpen={builder.iconPickerOpen}
          iconQuery={builder.iconQuery}
          applications={builder.applications}
          appStatus={builder.appStatus}
          appError={builder.appError}
          appQuery={builder.appQuery}
          preparingPath={builder.preparingPath}
          onSelect={builder.select}
          onRemove={builder.remove}
          onUpdate={(patch) => builder.updateSegment(selected.id, patch)}
          onIconOpenChange={builder.setIconPickerOpen}
          onIconQueryChange={builder.setIconQuery}
          onMoveChild={(index, direction) => builder.moveChild(selected.id, index, direction)}
          onAddChild={() => builder.addChild(selected.id)}
          onAppQueryChange={builder.setAppQuery}
          onBrowseApp={() => void builder.browseApplication()}
          onRetryApps={() => { builder.setAppStatus("idle"); }}
          onSelectApp={(path) => void builder.prepareApplication(selected.id, path)}
        /> : <EmptyState onAdd={builder.addAction} /> : <SettingsPanel platform={builder.platform} recording={recorder.recording} shortcutParts={recorder.parts} onRecord={recorder.start} onRestore={restoreShortcut}><StartupSettings launchAtLogin={builder.launchAtLogin} onLaunchAtLoginChange={builder.setLaunchAtLogin} showInTray={builder.showInTray} onShowInTrayChange={builder.setShowInTray} /><WheelBehaviorSettings spawnAtCursor={builder.spawnAtCursor} onSpawnAtCursorChange={builder.setSpawnAtCursor} cancelByCenter={builder.cancelByCenter} onCancelByCenterChange={builder.setCancelByCenter} cancelWithEscape={builder.cancelWithEscape} onCancelWithEscapeChange={builder.setCancelWithEscape} /><AppearanceSettings wheelScale={builder.wheelScale} onWheelScaleChange={builder.setWheelScale} wheelOpacity={builder.wheelOpacity} onWheelOpacityChange={builder.setWheelOpacity} /><BackupRestoreSettings transferring={builder.configTransfer} onExport={() => void builder.exportConfiguration()} onImport={() => void builder.importConfiguration()} /></SettingsPanel>}
      </main>
      <LivePreview segments={builder.segments} opacity={builder.wheelOpacity} saving={builder.saving} onSave={() => void builder.save()} />
    </div>
  </div>;
}

export default App;
