import { forwardRef, useEffect, useState } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  AirplaneTiltIcon,
  AnchorIcon,
  AppWindowIcon,
  BellIcon,
  BicycleIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BugIcon,
  CalculatorIcon,
  CalendarDotsIcon,
  CameraIcon,
  ChatCircleIcon,
  ClipboardTextIcon,
  ClockIcon,
  CloudIcon,
  CodeIcon,
  CoffeeIcon,
  CompassIcon,
  CrosshairIcon,
  DatabaseIcon,
  DesktopIcon,
  DownloadSimpleIcon,
  EnvelopeIcon,
  FileTextIcon,
  FolderOpenIcon,
  GameControllerIcon,
  GearSixIcon,
  GiftIcon,
  GlobeHemisphereWestIcon,
  HeartIcon,
  HouseIcon,
  ImageIcon,
  KeyboardIcon,
  LightningIcon,
  LinkIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MicrophoneIcon,
  MoonIcon,
  MusicNotesIcon,
  NotePencilIcon,
  PaletteIcon,
  PawPrintIcon,
  PhoneIcon,
  PlanetIcon,
  PlayIcon,
  PulseIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SmileyIcon,
  SpeakerHighIcon,
  SparkleIcon,
  StarIcon,
  SunIcon,
  TargetIcon,
  TerminalWindowIcon,
  TimerIcon,
  TreeIcon,
  TrophyIcon,
  UploadSimpleIcon,
  UserIcon,
  UsersThreeIcon,
  VideoCameraIcon,
  WifiHighIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import {
  Activity,
  AppWindow,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  Camera,
  CircleDot,
  ClipboardCopy,
  Clock3,
  Cloud,
  Code2,
  Command,
  Compass,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Focus,
  FolderOpen,
  Globe2,
  Heart,
  Home,
  Image,
  Keyboard,
  Link,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Monitor,
  Music2,
  NotebookPen,
  Palette,
  Play,
  Rocket,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Star,
  StickyNote,
  Terminal,
  Timer,
  Upload,
  User,
  Users,
  Video,
  Volume2,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

export type IconProvider = "lucide" | "phosphor";
export type SegmentIconComponent = LucideIcon | PhosphorIcon;

export type IconOption = {
  name: string;
  label: string;
  keywords: string[];
  Icon: SegmentIconComponent;
};

export const LUCIDE_ICON_OPTIONS: IconOption[] = [
  { name: "Search", label: "Search", keywords: ["find", "magnify"], Icon: Search },
  { name: "AppWindow", label: "Application", keywords: ["app", "window"], Icon: AppWindow },
  { name: "Compass", label: "Compass", keywords: ["browser", "safari", "navigate"], Icon: Compass },
  { name: "Monitor", label: "Monitor", keywords: ["screen", "desktop"], Icon: Monitor },
  { name: "Globe2", label: "Globe", keywords: ["web", "url", "internet"], Icon: Globe2 },
  { name: "FolderOpen", label: "Folder", keywords: ["files", "directory"], Icon: FolderOpen },
  { name: "FileText", label: "Document", keywords: ["file", "text"], Icon: FileText },
  { name: "Terminal", label: "Terminal", keywords: ["shell", "command"], Icon: Terminal },
  { name: "Code2", label: "Code", keywords: ["developer", "script"], Icon: Code2 },
  { name: "ClipboardCopy", label: "Clipboard", keywords: ["copy", "snippet"], Icon: ClipboardCopy },
  { name: "Copy", label: "Copy", keywords: ["duplicate", "clipboard"], Icon: Copy },
  { name: "NotebookPen", label: "Notes", keywords: ["write", "notebook"], Icon: NotebookPen },
  { name: "StickyNote", label: "Sticky note", keywords: ["note", "memo"], Icon: StickyNote },
  { name: "Music2", label: "Music", keywords: ["audio", "song"], Icon: Music2 },
  { name: "Play", label: "Play", keywords: ["media", "start"], Icon: Play },
  { name: "Volume2", label: "Volume", keywords: ["sound", "audio"], Icon: Volume2 },
  { name: "Mic", label: "Microphone", keywords: ["audio", "record"], Icon: Mic },
  { name: "Video", label: "Video", keywords: ["camera", "movie"], Icon: Video },
  { name: "Camera", label: "Camera", keywords: ["photo", "image"], Icon: Camera },
  { name: "Image", label: "Image", keywords: ["photo", "picture"], Icon: Image },
  { name: "Calculator", label: "Calculator", keywords: ["math", "numbers"], Icon: Calculator },
  { name: "CalendarDays", label: "Calendar", keywords: ["date", "schedule"], Icon: CalendarDays },
  { name: "Clock3", label: "Clock", keywords: ["time", "recent"], Icon: Clock3 },
  { name: "Timer", label: "Timer", keywords: ["time", "countdown"], Icon: Timer },
  { name: "Mail", label: "Mail", keywords: ["email", "message"], Icon: Mail },
  { name: "MessageCircle", label: "Message", keywords: ["chat", "comment"], Icon: MessageCircle },
  { name: "Bell", label: "Bell", keywords: ["notification", "alert"], Icon: Bell },
  { name: "Home", label: "Home", keywords: ["house", "start"], Icon: Home },
  { name: "User", label: "User", keywords: ["person", "profile"], Icon: User },
  { name: "Users", label: "Users", keywords: ["people", "team"], Icon: Users },
  { name: "BookOpen", label: "Book", keywords: ["read", "reference"], Icon: BookOpen },
  { name: "Database", label: "Database", keywords: ["data", "storage"], Icon: Database },
  { name: "Cloud", label: "Cloud", keywords: ["online", "sync"], Icon: Cloud },
  { name: "Download", label: "Download", keywords: ["save", "arrow"], Icon: Download },
  { name: "Upload", label: "Upload", keywords: ["send", "arrow"], Icon: Upload },
  { name: "Link", label: "Link", keywords: ["url", "chain"], Icon: Link },
  { name: "ExternalLink", label: "Open link", keywords: ["url", "external"], Icon: ExternalLink },
  { name: "Lock", label: "Lock", keywords: ["secure", "privacy"], Icon: Lock },
  { name: "Shield", label: "Shield", keywords: ["security", "protect"], Icon: Shield },
  { name: "Settings2", label: "Settings", keywords: ["preferences", "gear"], Icon: Settings2 },
  { name: "Wrench", label: "Tools", keywords: ["utility", "repair"], Icon: Wrench },
  { name: "Keyboard", label: "Keyboard", keywords: ["shortcut", "keys"], Icon: Keyboard },
  { name: "Command", label: "Command", keywords: ["shortcut", "mac"], Icon: Command },
  { name: "Focus", label: "Focus", keywords: ["target", "concentrate"], Icon: Focus },
  { name: "Workflow", label: "Workflow", keywords: ["automation", "nodes"], Icon: Workflow },
  { name: "Activity", label: "Activity", keywords: ["pulse", "status"], Icon: Activity },
  { name: "Palette", label: "Palette", keywords: ["color", "design"], Icon: Palette },
  { name: "Sparkles", label: "Sparkles", keywords: ["magic", "ai"], Icon: Sparkles },
  { name: "Zap", label: "Lightning", keywords: ["fast", "power"], Icon: Zap },
  { name: "Rocket", label: "Rocket", keywords: ["launch", "ship"], Icon: Rocket },
  { name: "Star", label: "Star", keywords: ["favorite", "featured"], Icon: Star },
  { name: "Heart", label: "Heart", keywords: ["favorite", "love"], Icon: Heart },
  { name: "CircleDot", label: "Target", keywords: ["circle", "dot"], Icon: CircleDot },
];

export const PHOSPHOR_ICON_OPTIONS: IconOption[] = [
  { name: "phosphor:MagnifyingGlass", label: "Search", keywords: ["find", "magnify"], Icon: MagnifyingGlassIcon },
  { name: "phosphor:AppWindow", label: "Application", keywords: ["app", "window"], Icon: AppWindowIcon },
  { name: "phosphor:Compass", label: "Compass", keywords: ["browser", "navigate"], Icon: CompassIcon },
  { name: "phosphor:Desktop", label: "Desktop", keywords: ["monitor", "screen"], Icon: DesktopIcon },
  { name: "phosphor:GlobeHemisphereWest", label: "Globe", keywords: ["web", "url", "internet"], Icon: GlobeHemisphereWestIcon },
  { name: "phosphor:FolderOpen", label: "Folder", keywords: ["files", "directory"], Icon: FolderOpenIcon },
  { name: "phosphor:FileText", label: "Document", keywords: ["file", "text"], Icon: FileTextIcon },
  { name: "phosphor:TerminalWindow", label: "Terminal", keywords: ["shell", "command"], Icon: TerminalWindowIcon },
  { name: "phosphor:Code", label: "Code", keywords: ["developer", "script"], Icon: CodeIcon },
  { name: "phosphor:ClipboardText", label: "Clipboard", keywords: ["copy", "snippet"], Icon: ClipboardTextIcon },
  { name: "phosphor:NotePencil", label: "Notes", keywords: ["write", "notebook"], Icon: NotePencilIcon },
  { name: "phosphor:MusicNotes", label: "Music", keywords: ["audio", "song"], Icon: MusicNotesIcon },
  { name: "phosphor:Play", label: "Play", keywords: ["media", "start"], Icon: PlayIcon },
  { name: "phosphor:SpeakerHigh", label: "Volume", keywords: ["sound", "audio"], Icon: SpeakerHighIcon },
  { name: "phosphor:Microphone", label: "Microphone", keywords: ["audio", "record"], Icon: MicrophoneIcon },
  { name: "phosphor:VideoCamera", label: "Video", keywords: ["camera", "movie"], Icon: VideoCameraIcon },
  { name: "phosphor:Camera", label: "Camera", keywords: ["photo", "image"], Icon: CameraIcon },
  { name: "phosphor:Image", label: "Image", keywords: ["photo", "picture"], Icon: ImageIcon },
  { name: "phosphor:Calculator", label: "Calculator", keywords: ["math", "numbers"], Icon: CalculatorIcon },
  { name: "phosphor:CalendarDots", label: "Calendar", keywords: ["date", "schedule"], Icon: CalendarDotsIcon },
  { name: "phosphor:Clock", label: "Clock", keywords: ["time", "recent"], Icon: ClockIcon },
  { name: "phosphor:Timer", label: "Timer", keywords: ["time", "countdown"], Icon: TimerIcon },
  { name: "phosphor:Envelope", label: "Mail", keywords: ["email", "message"], Icon: EnvelopeIcon },
  { name: "phosphor:ChatCircle", label: "Message", keywords: ["chat", "comment"], Icon: ChatCircleIcon },
  { name: "phosphor:Bell", label: "Bell", keywords: ["notification", "alert"], Icon: BellIcon },
  { name: "phosphor:House", label: "Home", keywords: ["house", "start"], Icon: HouseIcon },
  { name: "phosphor:User", label: "User", keywords: ["person", "profile"], Icon: UserIcon },
  { name: "phosphor:UsersThree", label: "Users", keywords: ["people", "team"], Icon: UsersThreeIcon },
  { name: "phosphor:BookOpen", label: "Book", keywords: ["read", "reference"], Icon: BookOpenIcon },
  { name: "phosphor:Database", label: "Database", keywords: ["data", "storage"], Icon: DatabaseIcon },
  { name: "phosphor:Cloud", label: "Cloud", keywords: ["online", "sync"], Icon: CloudIcon },
  { name: "phosphor:DownloadSimple", label: "Download", keywords: ["save", "arrow"], Icon: DownloadSimpleIcon },
  { name: "phosphor:UploadSimple", label: "Upload", keywords: ["send", "arrow"], Icon: UploadSimpleIcon },
  { name: "phosphor:Link", label: "Link", keywords: ["url", "chain"], Icon: LinkIcon },
  { name: "phosphor:Lock", label: "Lock", keywords: ["secure", "privacy"], Icon: LockIcon },
  { name: "phosphor:ShieldCheck", label: "Shield", keywords: ["security", "protect"], Icon: ShieldCheckIcon },
  { name: "phosphor:GearSix", label: "Settings", keywords: ["preferences", "gear"], Icon: GearSixIcon },
  { name: "phosphor:Wrench", label: "Tools", keywords: ["utility", "repair"], Icon: WrenchIcon },
  { name: "phosphor:Keyboard", label: "Keyboard", keywords: ["shortcut", "keys"], Icon: KeyboardIcon },
  { name: "phosphor:Crosshair", label: "Focus", keywords: ["target", "concentrate"], Icon: CrosshairIcon },
  { name: "phosphor:Pulse", label: "Activity", keywords: ["pulse", "status"], Icon: PulseIcon },
  { name: "phosphor:Palette", label: "Palette", keywords: ["color", "design"], Icon: PaletteIcon },
  { name: "phosphor:Sparkle", label: "Sparkle", keywords: ["magic", "ai"], Icon: SparkleIcon },
  { name: "phosphor:Lightning", label: "Lightning", keywords: ["fast", "power"], Icon: LightningIcon },
  { name: "phosphor:RocketLaunch", label: "Rocket", keywords: ["launch", "ship"], Icon: RocketLaunchIcon },
  { name: "phosphor:Star", label: "Star", keywords: ["favorite", "featured"], Icon: StarIcon },
  { name: "phosphor:Heart", label: "Heart", keywords: ["favorite", "love"], Icon: HeartIcon },
  { name: "phosphor:Target", label: "Target", keywords: ["goal", "bullseye"], Icon: TargetIcon },
  { name: "phosphor:AirplaneTilt", label: "Airplane", keywords: ["travel", "flight"], Icon: AirplaneTiltIcon },
  { name: "phosphor:Anchor", label: "Anchor", keywords: ["nautical", "ship"], Icon: AnchorIcon },
  { name: "phosphor:Bicycle", label: "Bicycle", keywords: ["bike", "travel"], Icon: BicycleIcon },
  { name: "phosphor:Briefcase", label: "Briefcase", keywords: ["work", "business"], Icon: BriefcaseIcon },
  { name: "phosphor:Bug", label: "Bug", keywords: ["debug", "developer"], Icon: BugIcon },
  { name: "phosphor:Coffee", label: "Coffee", keywords: ["drink", "break"], Icon: CoffeeIcon },
  { name: "phosphor:GameController", label: "Game", keywords: ["controller", "play"], Icon: GameControllerIcon },
  { name: "phosphor:Gift", label: "Gift", keywords: ["present", "reward"], Icon: GiftIcon },
  { name: "phosphor:MapPin", label: "Location", keywords: ["map", "place"], Icon: MapPinIcon },
  { name: "phosphor:Moon", label: "Moon", keywords: ["night", "dark"], Icon: MoonIcon },
  { name: "phosphor:PawPrint", label: "Paw", keywords: ["animal", "pet"], Icon: PawPrintIcon },
  { name: "phosphor:Phone", label: "Phone", keywords: ["call", "mobile"], Icon: PhoneIcon },
  { name: "phosphor:Planet", label: "Planet", keywords: ["space", "world"], Icon: PlanetIcon },
  { name: "phosphor:ShoppingCart", label: "Cart", keywords: ["shop", "buy"], Icon: ShoppingCartIcon },
  { name: "phosphor:Smiley", label: "Smiley", keywords: ["happy", "face"], Icon: SmileyIcon },
  { name: "phosphor:Sun", label: "Sun", keywords: ["day", "light"], Icon: SunIcon },
  { name: "phosphor:Tree", label: "Tree", keywords: ["nature", "forest"], Icon: TreeIcon },
  { name: "phosphor:Trophy", label: "Trophy", keywords: ["award", "winner"], Icon: TrophyIcon },
  { name: "phosphor:WifiHigh", label: "Wi-Fi", keywords: ["wireless", "network"], Icon: WifiHighIcon },
];

export const ICON_OPTIONS: IconOption[] = [...LUCIDE_ICON_OPTIONS, ...PHOSPHOR_ICON_OPTIONS];

const ICON_COMPONENTS = new Map(ICON_OPTIONS.map((option) => [option.name, option.Icon]));
const EXTENDED_LUCIDE_PREFIX = "lucide:";
const EXTENDED_LUCIDE_COMPONENTS = new Map<string, LucideIcon>();

let fullLucideIcons: Record<string, LucideIcon> | null = null;
let fullLucideOptions: IconOption[] | null = null;
let fullLucideCatalogPromise: Promise<IconOption[]> | null = null;

export function loadFullLucideOptions() {
  if (fullLucideOptions) return Promise.resolve(fullLucideOptions);
  if (!fullLucideCatalogPromise) {
    fullLucideCatalogPromise = import("./fullLucideCatalog")
      .then(({ FULL_LUCIDE_ICONS, createFullLucideOptions }) => {
        fullLucideIcons = FULL_LUCIDE_ICONS;
        const options = createFullLucideOptions(LUCIDE_ICON_OPTIONS);
        fullLucideOptions = options;
        return options;
      })
      .catch((error: unknown) => {
        fullLucideCatalogPromise = null;
        throw error;
      });
  }
  return fullLucideCatalogPromise;
}

function extendedLucideName(iconName: string) {
  return iconName.slice(EXTENDED_LUCIDE_PREFIX.length);
}

function getExtendedLucideIcon(iconName: string): LucideIcon {
  const existing = EXTENDED_LUCIDE_COMPONENTS.get(iconName);
  if (existing) return existing;

  const name = extendedLucideName(iconName);
  const ExtendedLucideIcon = forwardRef<SVGSVGElement, LucideProps>(
    (props, ref) => {
      const [LoadedIcon, setLoadedIcon] = useState<LucideIcon | null>(
        () => fullLucideIcons?.[name] || null,
      );

      useEffect(() => {
        if (LoadedIcon) return;
        let active = true;
        void loadFullLucideOptions()
          .then(() => {
            if (active) {
              setLoadedIcon(() => fullLucideIcons?.[name] || Sparkles);
            }
          })
          .catch(() => {
            if (active) setLoadedIcon(() => Sparkles);
          });
        return () => {
          active = false;
        };
      }, [LoadedIcon]);

      if (!LoadedIcon) return <Sparkles ref={ref} {...props} />;
      return <LoadedIcon ref={ref} {...props} />;
    },
  );
  ExtendedLucideIcon.displayName = `Lucide(${name})`;
  EXTENDED_LUCIDE_COMPONENTS.set(iconName, ExtendedLucideIcon);
  return ExtendedLucideIcon;
}

const LEGACY_ICON_NAMES: Record<string, string> = {
  "🔍": "Search",
  "📝": "NotebookPen",
  "📋": "ClipboardCopy",
  "📁": "FolderOpen",
  "🌐": "Globe2",
  "⚡": "Zap",
  "⭐": "Star",
  "❤️": "Heart",
  "🎵": "Music2",
  "📷": "Camera",
  "🧮": "Calculator",
  "⏱️": "Timer",
};

export function normalizeIconName(iconName: string) {
  if (ICON_COMPONENTS.has(iconName)) return iconName;
  if (
    iconName.startsWith(EXTENDED_LUCIDE_PREFIX) &&
    /^[A-Za-z][A-Za-z0-9]*$/.test(extendedLucideName(iconName))
  ) {
    return iconName;
  }
  return LEGACY_ICON_NAMES[iconName] || "Sparkles";
}

export function iconProviderForName(iconName: string): IconProvider {
  return iconName.startsWith("phosphor:") && ICON_COMPONENTS.has(iconName) ? "phosphor" : "lucide";
}

export function getSegmentIcon(iconName: string): SegmentIconComponent {
  const normalizedIconName = normalizeIconName(iconName);
  if (normalizedIconName.startsWith(EXTENDED_LUCIDE_PREFIX)) {
    return getExtendedLucideIcon(normalizedIconName);
  }
  return ICON_COMPONENTS.get(normalizedIconName) || Sparkles;
}
