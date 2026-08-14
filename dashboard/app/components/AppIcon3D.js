/**
 * AppIcon3D — Icônes hybrides modernes.
 * Rend une icône 3D @nobertdev/react-3d-icons quand un équivalent existe,
 * sinon replie sur lucide-react (même API size / className / style).
 */
"use client";

import {
  Bag as I3DBag, ChatBubble as I3DChat, Setting as I3DSetting, Wallet as I3DWallet,
  MoneyBag as I3DMoneyBag, Cube as I3DCube, Explorer as I3DHome, Travel as I3DTravel,
  Camera as I3DCamera, Plus as I3DPlus, Target as I3DTarget, Shield as I3DShield,
  Star as I3DStar, Heart as I3DHeart, Fire as I3DFire, Flash as I3DFlash, Bell as I3DBell,
  Lock as I3DLock, Key as I3DKey, Gift as I3DGift, Rocket as I3DRocket, Picture as I3DPicture,
  Mic as I3DMic, Mobile as I3DMobile, TrashCan as I3DTrash, Pencil as I3DPencil, Tick as I3DTick,
  FileText as I3DDoc, Folder as I3DFolder, Calendar as I3DCalendar, Clock as I3DClock,
  Message as I3DMessage, Tools as I3DTools, Medal as I3DMedal, Trophy as I3DTrophy,
  Headphone as I3DHeadphone,
} from "@nobertdev/react-3d-icons/front-color";
import {
  Home, ClipboardList, Bot, Package, Store, Share2, Truck, Wrench, RefreshCw,
  ChevronLeft, X, ShoppingBag,
} from "lucide-react";

const threeD = {
  home: I3DHome,
  plus: I3DPlus,
  camera: I3DCamera,
  orders: I3DMoneyBag,
  chat: I3DChat,
  messages: I3DChat,
  settings: I3DSetting,
  products: I3DCube,
  store: I3DBag,
  sharing: null,
  delivery: I3DTravel,
  payment: I3DWallet,
  crm: I3DTools,
  assistant: I3DHeadphone,
  target: I3DTarget,
  shield: I3DShield,
  star: I3DStar,
  heart: I3DHeart,
  fire: I3DFire,
  flash: I3DFlash,
  bell: I3DBell,
  lock: I3DLock,
  key: I3DKey,
  gift: I3DGift,
  rocket: I3DRocket,
  picture: I3DPicture,
  voice: I3DMic,
  mobile: I3DMobile,
  trash: I3DTrash,
  edit: I3DPencil,
  check: I3DTick,
  doc: I3DDoc,
  folder: I3DFolder,
  calendar: I3DCalendar,
  clock: I3DClock,
  message2: I3DMessage,
  medal: I3DMedal,
  trophy: I3DTrophy,
};

const lucide = {
  home: Home,
  plus: null,
  camera: null,
  orders: ClipboardList,
  chat: Bot,
  messages: Bot,
  settings: null,
  products: Package,
  store: Store,
  sharing: Share2,
  delivery: Truck,
  payment: ShoppingBag,
  crm: Bot,
  assistant: Wrench,
  refresh: RefreshCw,
  back: ChevronLeft,
  close: X,
};

/**
 * @param {string} app Clé sémantique utilisable (voir maps ci-dessus).
 * @param {number} [size] Taille en px.
 * @param {string} [className]
 * @param {object} [style]
 * @param {string} [alt]
 */
export default function AppIcon3D({ app, size = 20, className = "", style, alt = "" }) {
  const ThreeDComp = threeD[app];
  if (ThreeDComp) {
    const TheComp = ThreeDComp;
    return <TheComp width={size} height={size} className={className} style={style} alt={alt || app} loading="lazy" />;
  }
  const LucideComp = lucide[app];
  if (LucideComp) {
    const TheLucide = LucideComp;
    return <TheLucide size={size} className={className} style={style} />;
  }
  const Fallback = threeD.home;
  return <Fallback width={size} height={size} className={className} style={style} alt={app} loading="lazy" />;
}