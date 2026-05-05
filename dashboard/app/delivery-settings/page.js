"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { addDeliveryDriver, addDeliveryZone, deleteDeliveryDriver, deleteDeliveryZone, getSellerDeliverySettings, saveSellerDeliverySettings, updateDeliveryDriver, updateDeliveryZone } from "../actions";
import { useActiveSeller } from "../components/sellerContext";

const defaultSettings = {
  delivery_enabled: true,
  pickup_enabled: true,
  fixed_delivery_fee: 1000,
  delivery_payment_timing: "AT_RECEPTION",
  auto_share_to_driver: false,
};

const abidjanZoneSuggestions = [
  "Abobo",
  "Adjame",
  "Angre",
  "Bingerville",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Riviera",
  "Treichville",
  "Yopougon",
];

export default function DeliverySettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [drivers, setDrivers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "", phone_number: "", zone: "" });
  const [newZone, setNewZone] = useState({ name: "", fee: "" });
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingZone, setEditingZone] = useState(null);

  const fetchData = useCallback(async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const { seller: sellerData, drivers: driverData, zones: zoneData } = await getSellerDeliverySettings(activeSeller.slug);
      setSeller(sellerData);
      setSettings({
        delivery_enabled: sellerData.delivery_enabled ?? true,
        pickup_enabled: sellerData.pickup_enabled ?? true,
        fixed_delivery_fee: sellerData.fixed_delivery_fee ?? 1000,
        delivery_payment_timing: sellerData.delivery_payment_timing ?? "AT_RECEPTION",
        auto_share_to_driver: sellerData.auto_share_to_driver ?? false,
      });

      setDrivers(driverData || []);
      setZones(zoneData || []);
    } catch (err) {
      console.error("Error fetching delivery settings:", err);
      setError(err.message || "Impossible de charger les parametres.");
    } finally {
      setLoading(false);
    }
  }, [activeSeller.slug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchData]);

  async function saveSettings() {
    if (!seller) return;

    try {
      setSaving(true);
      setError("");
      await saveSellerDeliverySettings(seller.id, settings);
      alert("Parametres enregistres.");
      await fetchData();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  function openDriverModal(driver = null) {
    setEditingDriver(driver);
    setNewDriver(driver ? {
      name: driver.name || "",
      phone_number: driver.phone_number || "",
      zone: driver.zone || "",
    } : { name: "", phone_number: "", zone: "" });
    setShowAddDriver(true);
  }

  function closeDriverModal() {
    setShowAddDriver(false);
    setEditingDriver(null);
    setNewDriver({ name: "", phone_number: "", zone: "" });
  }

  async function handleSaveDriver() {
    if (!seller) return;

    try {
      setSaving(true);
      const driver = editingDriver
        ? await updateDeliveryDriver(editingDriver.id, newDriver)
        : await addDeliveryDriver(seller.id, newDriver);

      setDrivers((current) => (
        editingDriver
          ? current.map((item) => (item.id === driver.id ? driver : item))
          : [driver, ...current]
      ));
      closeDriverModal();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer le livreur.");
    } finally {
      setSaving(false);
    }
  }

  function openZoneModal(zone = null) {
    setEditingZone(zone);
    setNewZone(zone ? { name: zone.name || "", fee: String(zone.fee ?? "") } : { name: "", fee: "" });
    setShowAddZone(true);
  }

  function openSuggestedZone(name) {
    setEditingZone(null);
    setNewZone({ name, fee: "" });
    setShowAddZone(true);
  }

  function closeZoneModal() {
    setShowAddZone(false);
    setEditingZone(null);
    setNewZone({ name: "", fee: "" });
  }

  async function handleSaveZone() {
    if (!seller) return;

    try {
      setSaving(true);
      const zone = editingZone
        ? await updateDeliveryZone(editingZone.id, newZone)
        : await addDeliveryZone(seller.id, newZone);

      setZones((current) => {
        const next = editingZone
          ? current.map((item) => (item.id === zone.id ? zone : item))
          : [...current, zone];

        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      closeZoneModal();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer la zone.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteZone(zoneId) {
    try {
      await deleteDeliveryZone(zoneId);
      setZones((current) => current.filter((zone) => zone.id !== zoneId));
    } catch (err) {
      setError(err.message || "Impossible de supprimer la zone.");
    }
  }

  async function handleDeleteDriver(driverId) {
    try {
      await deleteDeliveryDriver(driverId);
      setDrivers((current) => current.filter((driver) => driver.id !== driverId));
    } catch (err) {
      setError(err.message || "Impossible de supprimer le livreur.");
    }
  }

  return (
    <div className="app-shell">
      <header className="mobile-top">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold leading-10 text-[var(--text-main)]">Réglages de livraison</h1>
            <p className="mt-1 text-base text-[var(--text-dim)]">Configurez vos options d&apos;expédition, zones et livreurs.</p>
          </div>
          <button onClick={saveSettings} disabled={saving || !seller} className="app-icon-button bg-[var(--primary-bright)] text-white disabled:bg-[var(--surface-mid)]" aria-label="Enregistrer">
            <Save size={19} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
          <p className="mt-4 font-extrabold text-zinc-400">Chargement...</p>
        </div>
      ) : (
        <main className="mt-8 space-y-5 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-start">
          <section className="space-y-5">
          <div>
            <h2 className="mb-6 flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
              <Truck className="text-[var(--primary)]" size={21} />
              Modes de livraison
            </h2>
            <div className="app-card overflow-hidden p-2">
              <ToggleRow
                title="Livraison a domicile"
                text="Le client renseigne son quartier et son adresse."
                active={settings.delivery_enabled}
                onClick={() => setSettings({ ...settings, delivery_enabled: !settings.delivery_enabled })}
              />
              <ToggleRow
                title="Retrait sur place"
                text="Le client peut choisir de venir recuperer."
                active={settings.pickup_enabled}
                onClick={() => setSettings({ ...settings, pickup_enabled: !settings.pickup_enabled })}
              />
              <ToggleRow
                title="Partage livreur auto"
                text="Prepare l'envoi au livreur assigne quand une commande arrive."
                active={settings.auto_share_to_driver}
                onClick={() => setSettings({ ...settings, auto_share_to_driver: !settings.auto_share_to_driver })}
              />
            </div>
          </div>

          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
              <CheckCircle2 className="text-[var(--primary)]" size={21} />
              Frais & Paiement
            </h2>
            <div className="app-card p-5">
              <label className="block">
                <span className="quiet-label mb-2 block">Frais de livraison fixes (CFA)</span>
                <input type="number" value={settings.fixed_delivery_fee} onChange={(event) => setSettings({ ...settings, fixed_delivery_fee: event.target.value })} className="mobile-input" placeholder="1000" />
              </label>

              <div className="mt-5 space-y-3">
                <PaymentChoice
                  title="A la reception"
                  text="Le livreur encaisse les frais."
                  active={settings.delivery_payment_timing === "AT_RECEPTION"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "AT_RECEPTION" })}
                />
                <PaymentChoice
                  title="Inclus au paiement"
                  text="Le client paie produit + livraison."
                  active={settings.delivery_payment_timing === "INCLUDED"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "INCLUDED" })}
                />
                <PaymentChoice
                  title="Offert"
                  text="La boutique prend en charge."
                  active={settings.delivery_payment_timing === "OFFERED"}
                  onClick={() => setSettings({ ...settings, delivery_payment_timing: "OFFERED" })}
                />
              </div>
            </div>
          </div>
          </section>

          <section>
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
                  <MapPin className="text-[var(--primary)]" size={21} />
                  Gestion des zones
                </h2>
                <button onClick={() => openZoneModal()} className="flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                  <Plus size={16} strokeWidth={3} />
                  Ajouter
                </button>
              </div>

              {zones.length === 0 ? (
                <div className="app-card p-6 text-center">
                  <MapPin className="mx-auto text-zinc-300" size={30} />
                  <p className="mt-3 font-extrabold text-zinc-950">Frais fixes actifs</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-400">Ajoute librement les communes, quartiers ou sous-quartiers que tu livres.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {abidjanZoneSuggestions.slice(0, 8).map((name) => (
                      <button key={name} onClick={() => openSuggestedZone(name)} className="min-h-[36px] rounded-full bg-[var(--surface-mid)] px-3 text-sm font-semibold text-[var(--text-main)]">
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {zones.map((zone) => (
                    <div key={zone.id} className="app-card flex items-center justify-between p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-mid)] text-[var(--outline)]">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-main)]">{zone.name}</p>
                          <p className="truncate text-sm text-[var(--primary)]">{Number(zone.fee || 0).toLocaleString("fr-FR")} F</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => openZoneModal(zone)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-500" aria-label={`Modifier ${zone.name}`}>
                          <Pencil size={17} />
                        </button>
                        <button onClick={() => handleDeleteZone(zone.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300" aria-label={`Supprimer ${zone.name}`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-main)]">
                <Truck className="text-[var(--primary)]" size={21} />
                Livreurs
              </h2>
              <button onClick={() => openDriverModal()} className="flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                <Plus size={16} strokeWidth={3} />
                Ajouter
              </button>
            </div>

            {drivers.length === 0 ? (
              <div className="app-card p-7 text-center">
                <Truck className="mx-auto text-zinc-300" size={34} />
                <p className="mt-3 font-extrabold text-zinc-950">Aucun livreur</p>
                <p className="mt-1 text-sm font-semibold text-zinc-400">Ajoute les numeros WhatsApp de ta panoplie.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <div key={driver.id} className="app-card flex items-center justify-between p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-container)] text-[var(--on-secondary-fixed)]">
                        <User size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--text-main)]">{driver.name}</p>
                        <p className="truncate text-sm text-[var(--text-dim)]">{driver.phone_number} / {driver.zone || "Toutes zones"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openDriverModal(driver)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-500" aria-label={`Modifier ${driver.name}`}>
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => handleDeleteDriver(driver.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300" aria-label={`Supprimer ${driver.name}`}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>
        </main>
      )}

      {showAddDriver && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-zinc-950">{editingDriver ? "Modifier le livreur" : "Nouveau livreur"}</h2>
              <button onClick={closeDriverModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input className="mobile-input bg-zinc-50" placeholder="Nom du livreur" value={newDriver.name} onChange={(event) => setNewDriver({ ...newDriver, name: event.target.value })} />
              <input className="mobile-input bg-zinc-50" placeholder="WhatsApp" value={newDriver.phone_number} onChange={(event) => setNewDriver({ ...newDriver, phone_number: event.target.value })} />
              <input className="mobile-input bg-zinc-50" placeholder="Zone optionnelle" value={newDriver.zone} onChange={(event) => setNewDriver({ ...newDriver, zone: event.target.value })} />
            </div>
            <button onClick={handleSaveDriver} disabled={saving} className="mt-5 min-h-[56px] w-full rounded-lg bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              {editingDriver ? "Mettre a jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {showAddZone && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold text-zinc-950">{editingZone ? "Modifier la zone" : "Nouvelle zone"}</h2>
              <button onClick={closeZoneModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input className="mobile-input bg-zinc-50" placeholder="Ex: Angre, Riviera 2, Koumassi..." value={newZone.name} onChange={(event) => setNewZone({ ...newZone, name: event.target.value })} />
              <input className="mobile-input bg-zinc-50" type="number" placeholder="Frais livraison" value={newZone.fee} onChange={(event) => setNewZone({ ...newZone, fee: event.target.value })} />
            </div>
            <button onClick={handleSaveZone} disabled={saving} className="mt-5 min-h-[56px] w-full rounded-lg bg-zinc-950 text-base font-extrabold text-white disabled:bg-zinc-300">
              {editingZone ? "Mettre a jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ title, text, active, onClick }) {
  return (
    <button onClick={onClick} className="flex min-h-[82px] w-full items-center justify-between gap-4 border-b border-[var(--surface-mid)] p-4 text-left last:border-b-0">
      <div>
        <p className="font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[var(--text-dim)]">{text}</p>
      </div>
      <div className={`h-6 w-12 shrink-0 rounded-full p-0.5 transition ${active ? "bg-[var(--primary-bright)]" : "bg-[var(--surface-mid)]"}`}>
        <div className={`h-5 w-5 rounded-full bg-white transition ${active ? "translate-x-6" : ""}`} />
      </div>
    </button>
  );
}

function PaymentChoice({ title, text, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex min-h-[72px] w-full items-center justify-between gap-4 rounded-lg border p-3 text-left ${active ? "border-[var(--primary-bright)] bg-[var(--surface-soft)]" : "border-[var(--outline)]/45 bg-white"}`}>
      <div>
        <p className="font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-xs leading-4 text-[var(--text-dim)]">{text}</p>
      </div>
      {active && <CheckCircle2 className="text-[var(--primary)]" size={20} />}
    </button>
  );
}
