"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { addDeliveryDriver, addDeliveryZone, addDeliveryZonesBulk, deleteDeliveryDriver, deleteDeliveryZone, getSellerDeliverySettings, saveSellerDeliverySettings, updateDeliveryDriver, updateDeliveryZone } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import { ABIDJAN_DELIVERY_AREAS } from "../../lib/local-commerce";
import { IllustrationDelivery } from "../components/TikchopIllustrations";

const defaultSettings = {
  delivery_enabled: true,
  pickup_enabled: true,
  fixed_delivery_fee: 1000,
  delivery_payment_timing: "AT_RECEPTION",
  auto_share_to_driver: false,
};

const abidjanZoneSuggestions = ABIDJAN_DELIVERY_AREAS;

export default function DeliverySettingsPage() {
  const activeSeller = useActiveSeller();
  const [seller, setSeller] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [drivers, setDrivers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "", phone_number: "", zone: "" });
  const [newZone, setNewZone] = useState({ name: "", fee: "" });
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const nextAction = getDeliveryNextAction({
    zones,
    drivers,
    settings,
    onAddZone: () => openZoneModal(),
    onAddDriver: () => openDriverModal(),
    onSave: saveSettings,
  });

  const fetchData = useCallback(async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const token = await getSellerAccessToken();
      const { seller: sellerData, drivers: driverData, zones: zoneData } = await getSellerDeliverySettings(activeSeller.slug, token);
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
      setError(friendlyError(err, "Livraison non chargee. Verifiez la connexion puis actualisez."));
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
      setNotice("");
      const token = await getSellerAccessToken();
      await saveSellerDeliverySettings(seller.id, settings, token);
      setNotice("Parametres enregistres.");
      await fetchData();
    } catch (err) {
      setError(friendlyError(err, "Reglages non sauvegardes. Gardez la page ouverte puis relancez l'enregistrement."));
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
      const token = await getSellerAccessToken();
      const driver = editingDriver
        ? await updateDeliveryDriver(editingDriver.id, newDriver, token)
        : await addDeliveryDriver(seller.id, newDriver, token);

      setDrivers((current) => (
        editingDriver
          ? current.map((item) => (item.id === driver.id ? driver : item))
          : [driver, ...current]
      ));
      closeDriverModal();
    } catch (err) {
      setError(friendlyError(err, "Livreur non enregistre. Verifiez le nom et le numero WhatsApp."));
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
      const token = await getSellerAccessToken();
      const zone = editingZone
        ? await updateDeliveryZone(editingZone.id, newZone, token)
        : await addDeliveryZone(seller.id, newZone, token);

      setZones((current) => {
        const next = editingZone
          ? current.map((item) => (item.id === zone.id ? zone : item))
          : [...current, zone];

        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      closeZoneModal();
    } catch (err) {
      setError(friendlyError(err, "Commune non enregistree. Verifiez le nom du quartier et le tarif."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAbidjanZones() {
    if (!seller) return;

    try {
      setSaving(true);
      setError("");
      const token = await getSellerAccessToken();
      const fee = Number(settings.fixed_delivery_fee || 1000);
      const inserted = await addDeliveryZonesBulk(
        seller.id,
        abidjanZoneSuggestions.map((name) => ({ name, fee })),
        token,
      );

      if (inserted.length === 0) {
      setError("Les communes Abidjan sont deja dans votre liste. Vous pouvez modifier les frais une par une.");
        return;
      }

      setZones((current) => [...current, ...inserted].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(friendlyError(err, "Communes non ajoutees. Reessayez avec une bonne connexion."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteZone(zoneId) {
    try {
      const token = await getSellerAccessToken();
      await deleteDeliveryZone(zoneId, token);
      setZones((current) => current.filter((zone) => zone.id !== zoneId));
    } catch (err) {
      setError(friendlyError(err, "Commune gardee pour le moment."));
    }
  }

  async function handleDeleteDriver(driverId) {
    try {
      const token = await getSellerAccessToken();
      await deleteDeliveryDriver(driverId, token);
      setDrivers((current) => current.filter((driver) => driver.id !== driverId));
    } catch (err) {
      setError(friendlyError(err, "Livreur garde pour le moment."));
    }
  }

  return (
    <div className="app-shell">
      {/* Desktop Header */}
      <header className="mobile-top hidden md:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[#059669]">Livraison</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-10 text-[#0F2B20]">Livraison client</h1>
            <p className="mt-1 text-base text-[#0F2B20]/55">Retrait, communes, frais et livreurs WhatsApp.</p>
          </div>
          <button onClick={saveSettings} disabled={saving || !seller} className="app-icon-button bg-[#0F2B20] text-[#34D399] disabled:bg-[#0F2B20]/30" aria-label="Enregistrer">
            <Save size={19} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#E7F6ED] p-4 text-sm font-semibold text-[#047857] ring-1 ring-emerald-200">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#059669] border-t-transparent" />
          <p className="mt-4 font-extrabold text-[#0F2B20]/40">Chargement...</p>
        </div>
      ) : (
        <main className="mt-4 space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:mt-8 md:space-y-5 md:pb-0">

          {/* Next Action Banner */}
          <DeliveryNextActionCard action={nextAction} saving={saving} />

          {/* Stats Row — desktop */}
          <section className="hidden grid-cols-3 gap-3 md:grid">
            <DeliveryStat icon={<MapPin size={17} />} label="Communes" value={zones.length} tone="primary" />
            <DeliveryStat icon={<Truck size={17} />} label="Livreurs" value={drivers.length} tone="info" />
            <DeliveryStat icon={<CircleDollarSign size={17} />} label="Frais" value={`${Number(settings.fixed_delivery_fee || 0).toLocaleString("fr-FR")} F`} tone="accent" />
          </section>

          <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-start">

            {/* Left column: toggles + fee */}
            <section className="space-y-4">

              {/* Delivery options toggles */}
              <div className="overflow-hidden rounded-[26px] bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10 shadow-[0_2px_12px_rgba(15, 43, 32,0.07)]">
                <div className="flex items-center gap-2 border-b border-[#0F2B20]/8 px-4 py-3">
                  <Truck className="text-[#059669]" size={19} />
                  <h2 className="font-display text-lg font-black text-[#0F2B20]">Options client</h2>
                </div>
                <div className="divide-y divide-[#0F2B20]/7">
                  <ToggleRow
                    title="Livraison"
                    text="Le client renseigne commune, quartier et adresse."
                    active={settings.delivery_enabled}
                    onClick={() => setSettings({ ...settings, delivery_enabled: !settings.delivery_enabled })}
                  />
                  <ToggleRow
                    title="Retrait"
                    text="Le client vient recuperer la commande."
                    active={settings.pickup_enabled}
                    onClick={() => setSettings({ ...settings, pickup_enabled: !settings.pickup_enabled })}
                  />
                  <ToggleRow
                    title="Envoyer au livreur auto"
                    text="Quand le colis est pret, Tikchop envoie la fiche au livreur."
                    active={settings.auto_share_to_driver}
                    onClick={() => setSettings({ ...settings, auto_share_to_driver: !settings.auto_share_to_driver })}
                  />
                </div>
              </div>

              {/* Delivery fee + payment timing */}
              <div className="overflow-hidden rounded-[26px] bg-[#F6FBF7] ring-1 ring-[#0F2B20]/10 shadow-[0_2px_12px_rgba(15, 43, 32,0.07)]">
                <div className="flex items-center gap-2 border-b border-[#0F2B20]/8 px-4 py-3">
                  <CircleDollarSign className="text-[#059669]" size={19} />
                  <h2 className="font-display text-lg font-black text-[#0F2B20]">Prix de livraison</h2>
                </div>
                <div className="p-4 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#0F2B20]/50">Frais par defaut</span>
                    <div className="flex items-center gap-2 overflow-hidden rounded-2xl bg-white ring-1 ring-[#0F2B20]/12">
                      <span className="flex h-[54px] items-center justify-center border-r border-[#0F2B20]/10 px-4 text-sm font-black text-[#059669]">FCFA</span>
                      <input
                        type="number"
                        value={settings.fixed_delivery_fee}
                        onChange={(event) => setSettings({ ...settings, fixed_delivery_fee: event.target.value })}
                        className="flex-1 bg-transparent px-3 py-3 text-base font-black text-[#0F2B20] outline-none"
                        placeholder="1000"
                      />
                    </div>
                  </label>

                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[#0F2B20]/50">Quand payer ?</p>
                    <div className="grid gap-2">
                      <PaymentChoice
                        title="Apres reception"
                        text="Le client paie le livreur a la livraison."
                        active={settings.delivery_payment_timing === "AT_RECEPTION"}
                        onClick={() => setSettings({ ...settings, delivery_payment_timing: "AT_RECEPTION" })}
                      />
                      <PaymentChoice
                        title="Inclus au paiement"
                        text="Le client paie article + livraison ensemble."
                        active={settings.delivery_payment_timing === "INCLUDED"}
                        onClick={() => setSettings({ ...settings, delivery_payment_timing: "INCLUDED" })}
                      />
                      <PaymentChoice
                        title="Livraison offerte"
                        text="Vous offrez les frais de livraison au client."
                        active={settings.delivery_payment_timing === "OFFERED"}
                        onClick={() => setSettings({ ...settings, delivery_payment_timing: "OFFERED" })}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving || !seller}
                    className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] px-4 text-sm font-black text-white active:scale-[0.99] disabled:bg-[#0F2B20]/30"
                  >
                    {saving ? "Enregistrement..." : <><Save size={17} /> Enregistrer livraison</>}
                  </button>
                </div>
              </div>
            </section>

            {/* Right column: zones + drivers */}
            <section className="space-y-5">

              {/* Zones */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-[#059669]" size={19} />
                    <h2 className="font-display text-lg font-black text-[#0F2B20]">Communes</h2>
                    {zones.length > 0 && (
                      <span className="rounded-full bg-[#059669]/10 px-2.5 py-0.5 text-xs font-black text-[#059669]">{zones.length}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAbidjanZones}
                      disabled={saving}
                      className="hidden min-h-[38px] items-center gap-1.5 rounded-full bg-[#F6FBF7] px-3 text-sm font-extrabold text-[#059669] ring-1 ring-[#059669]/20 disabled:opacity-60 min-[390px]:flex"
                    >
                      Abidjan
                    </button>
                    <button
                      onClick={() => openZoneModal()}
                      className="flex min-h-[38px] items-center gap-1 rounded-full bg-[#0F2B20] px-3 text-sm font-extrabold text-white"
                    >
                      <Plus size={15} strokeWidth={3} />
                      Ajouter
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddAbidjanZones}
                  disabled={saving}
                  className="mb-3 flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-[#F6FBF7] px-4 text-sm font-extrabold text-[#059669] ring-1 ring-[#059669]/15 disabled:opacity-60 min-[390px]:hidden"
                >
                  Ajouter les communes d&apos;Abidjan
                </button>

                {zones.length === 0 ? (
                  <div className="rounded-[22px] bg-[#F6FBF7] p-6 text-center ring-1 ring-[#0F2B20]/8">
                    <MapPin className="mx-auto text-[#0F2B20]/20" size={30} />
                    <p className="mt-3 font-extrabold text-[#0F2B20]">Frais fixes actifs</p>
                    <p className="mt-1 text-sm font-semibold text-[#0F2B20]/50">Ajoutez les communes d&apos;Abidjan en un geste, puis ajustez les frais.</p>
                    <button
                      onClick={handleAddAbidjanZones}
                      disabled={saving}
                      className="mt-4 min-h-[50px] w-full rounded-2xl bg-[#0F2B20] text-sm font-extrabold text-white disabled:bg-[#0F2B20]/30"
                    >
                      {saving ? "Ajout..." : "Ajouter Abidjan"}
                    </button>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {abidjanZoneSuggestions.slice(0, 12).map((name) => (
                        <button
                          key={name}
                          onClick={() => openSuggestedZone(name)}
                          className="min-h-[36px] rounded-full bg-white px-3 text-sm font-extrabold text-[#059669] ring-1 ring-[#059669]/20"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center justify-between rounded-[18px] bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/8">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#059669] shadow-sm">
                            <MapPin size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#0F2B20]">{zone.name}</p>
                            <p className="truncate text-xs font-bold text-[#059669]">{Number(zone.fee || 0).toLocaleString("fr-FR")} F</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openZoneModal(zone)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0F2B20]/50 shadow-sm"
                            aria-label={`Modifier ${zone.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[#0F2B20]/25"
                            aria-label={`Supprimer ${zone.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drivers */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="text-[#059669]" size={19} />
                    <h2 className="font-display text-lg font-black text-[#0F2B20]">Livreurs</h2>
                    {drivers.length > 0 && (
                      <span className="rounded-full bg-[#059669]/10 px-2.5 py-0.5 text-xs font-black text-[#059669]">{drivers.length}</span>
                    )}
                  </div>
                  <button
                    onClick={() => openDriverModal()}
                    className="flex min-h-[38px] items-center gap-1 rounded-full bg-[#0F2B20] px-3 text-sm font-extrabold text-white"
                  >
                    <Plus size={15} strokeWidth={3} />
                    Ajouter
                  </button>
                </div>

                {drivers.length === 0 ? (
                  <div className="relative overflow-hidden rounded-[24px] bg-[#0F2B20] p-6 text-center">
                    <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(52, 211, 153,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(52, 211, 153,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
                    <div className="relative z-10 flex flex-col items-center">
                      <IllustrationDelivery size={96} className="opacity-90" />
                      <p className="mt-2 font-display text-base font-black text-white">Aucun livreur</p>
                      <p className="mt-1 text-xs font-semibold text-white/50 max-w-[220px]">Ajoutez les numeros WhatsApp des livreurs pour envoyer automatiquement les fiches.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drivers.map((driver) => (
                      <div key={driver.id} className="flex items-center justify-between rounded-[18px] bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/8">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#059669] shadow-sm">
                            <User size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#0F2B20]">{driver.name}</p>
                            <p className="truncate text-xs font-bold text-[#0F2B20]/50">{driver.phone_number} / {driver.zone || "Toutes communes"}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openDriverModal(driver)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0F2B20]/50 shadow-sm"
                            aria-label={`Modifier ${driver.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteDriver(driver.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[#0F2B20]/25"
                            aria-label={`Supprimer ${driver.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      )}

      {/* Add/Edit Driver Modal */}
      {showAddDriver && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[26px] bg-[#F6FBF7] shadow-2xl ring-1 ring-[#0F2B20]/10">
            <div className="flex items-center justify-between border-b border-[#0F2B20]/8 px-5 py-4">
              <h2 className="font-display text-xl font-black text-[#0F2B20]">{editingDriver ? "Modifier le livreur" : "Nouveau livreur"}</h2>
              <button onClick={closeDriverModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F2B20]/8" aria-label="Fermer">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <input
                className="mobile-input bg-white ring-1 ring-[#0F2B20]/12"
                placeholder="Nom du livreur"
                value={newDriver.name}
                onChange={(event) => setNewDriver({ ...newDriver, name: event.target.value })}
              />
              <input
                className="mobile-input bg-white ring-1 ring-[#0F2B20]/12"
                placeholder="WhatsApp (+225...)"
                value={newDriver.phone_number}
                onChange={(event) => setNewDriver({ ...newDriver, phone_number: event.target.value })}
              />
              <input
                className="mobile-input bg-white ring-1 ring-[#0F2B20]/12"
                placeholder="Commune ou zone (optionnel)"
                value={newDriver.zone}
                onChange={(event) => setNewDriver({ ...newDriver, zone: event.target.value })}
              />
              <button
                onClick={handleSaveDriver}
                disabled={saving}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] text-base font-extrabold text-white disabled:bg-[#0F2B20]/30"
              >
                {editingDriver ? "Mettre a jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 z-[260] flex items-end bg-black/50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:items-center">
          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[26px] bg-[#F6FBF7] shadow-2xl ring-1 ring-[#0F2B20]/10">
            <div className="flex items-center justify-between border-b border-[#0F2B20]/8 px-5 py-4">
              <h2 className="font-display text-xl font-black text-[#0F2B20]">{editingZone ? "Modifier la commune" : "Nouvelle commune"}</h2>
              <button onClick={closeZoneModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F2B20]/8" aria-label="Fermer">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <input
                className="mobile-input bg-white ring-1 ring-[#0F2B20]/12"
                placeholder="Ex: Cocody, Angre, Riviera..."
                value={newZone.name}
                onChange={(event) => setNewZone({ ...newZone, name: event.target.value })}
              />
              <div className="flex items-center gap-2 overflow-hidden rounded-2xl bg-white ring-1 ring-[#0F2B20]/12">
                <span className="flex h-[54px] items-center justify-center border-r border-[#0F2B20]/10 px-4 text-sm font-black text-[#059669]">FCFA</span>
                <input
                  type="number"
                  className="flex-1 bg-transparent px-3 py-3 text-base font-black text-[#0F2B20] outline-none"
                  placeholder="Frais de livraison"
                  value={newZone.fee}
                  onChange={(event) => setNewZone({ ...newZone, fee: event.target.value })}
                />
              </div>
              <button
                onClick={handleSaveZone}
                disabled={saving}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0F2B20] text-base font-extrabold text-white disabled:bg-[#0F2B20]/30"
              >
                {editingZone ? "Mettre a jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDeliveryNextAction({ zones, drivers, settings, onAddZone, onAddDriver, onSave }) {
  if (zones.length === 0 && settings.delivery_enabled) {
    return {
      step: "1",
      title: "Ajoutez les communes",
      body: "Indiquez les communes ou quartiers ou vous livrez et leurs frais.",
      label: "Ajouter une commune",
      icon: <MapPin size={20} />,
      onClick: onAddZone,
    };
  }

  if (drivers.length === 0 && settings.delivery_enabled) {
    return {
      step: "2",
      title: "Ajoutez un livreur",
      body: "Son numero WhatsApp recevra la fiche client quand le colis est pret.",
      label: "Ajouter un livreur",
      icon: <Truck size={20} />,
      onClick: onAddDriver,
    };
  }

  return {
    step: "✓",
    title: "Livraison prete",
    body: "Les clients peuvent choisir retrait ou livraison selon vos reglages.",
    label: "Enregistrer les reglages",
    icon: <Save size={20} />,
    onClick: onSave,
    strong: true,
  };
}

function DeliveryNextActionCard({ action, saving }) {
  return (
    <section className={`rounded-[26px] p-4 ${action.strong ? "bg-[#0F2B20] text-white" : "bg-[#F6FBF7] text-[#0F2B20] ring-1 ring-[#0F2B20]/10"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${action.strong ? "bg-[#34D399]/20 text-[#34D399]" : "bg-white text-[#059669] shadow-sm"}`}>
          {action.step}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[0.68rem] font-black uppercase tracking-[0.12em] ${action.strong ? "text-[#34D399]/80" : "text-[#059669]"}`}>Action suivante</p>
          <h2 className="mt-1 font-display text-xl font-bold leading-7">{action.title}</h2>
          <p className={`mt-1 text-sm leading-5 ${action.strong ? "text-white/65" : "text-[#0F2B20]/55"}`}>{action.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={action.onClick}
        disabled={saving}
        className={`mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold active:scale-[0.99] disabled:opacity-70 ${
          action.strong ? "bg-[#34D399] text-[#0F2B20]" : "bg-[#0F2B20] text-white"
        }`}
      >
        {saving ? "Enregistrement..." : action.icon}
        {saving ? "" : action.label}
        {!saving && <ArrowRight size={17} />}
      </button>
    </section>
  );
}

function DeliveryStat({ icon, label, value, tone }) {
  const toneClass = {
    primary: "bg-[#059669]/10 text-[#059669]",
    info: "bg-blue-50 text-blue-600",
    accent: "bg-amber-50 text-amber-600",
  }[tone];

  return (
    <div className="rounded-[18px] bg-[#F6FBF7] p-3 ring-1 ring-[#0F2B20]/8">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </span>
      <p className="mt-3 font-display text-lg font-bold leading-none text-[#0F2B20]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#0F2B20]/50">{label}</p>
    </div>
  );
}

function ToggleRow({ title, text, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[70px] w-full items-center justify-between gap-4 px-4 py-3 text-left"
    >
      <div>
        <p className="text-sm font-black text-[#0F2B20]">{title}</p>
        <p className="mt-0.5 text-xs font-bold leading-4 text-[#0F2B20]/50">{text}</p>
      </div>
      <div className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${active ? "bg-[#059669]" : "bg-[#0F2B20]/15"}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? "translate-x-5" : ""}`} />
      </div>
    </button>
  );
}

function PaymentChoice({ title, text, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition-colors ${
        active ? "border-[#059669]/40 bg-[#EAF8F0]" : "border-[#0F2B20]/10 bg-white"
      }`}
    >
      <div>
        <p className={`text-sm font-black ${active ? "text-[#0F2B20]" : "text-[#0F2B20]"}`}>{title}</p>
        <p className="mt-0.5 text-xs font-bold leading-4 text-[#0F2B20]/50">{text}</p>
      </div>
      {active && <CheckCircle2 className="shrink-0 text-[#059669]" size={19} />}
    </button>
  );
}
