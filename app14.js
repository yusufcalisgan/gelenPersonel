// Supabase bağlantı bilgileri
const SUPABASE_URL = "https://igbdsssdcnteybawxfqj.supabase.co";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYmRzc3NkY250ZXliYXd4ZnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDA5NDIsImV4cCI6MjA3MTUxNjk0Mn0.mItvF3JMdV3-MByhrTRNmTLgy5v9ypp4ks8SmGlTY3E";
const sb = window.supabase.createClient(SUPABASE_URL, API_KEY);

const HEDEF_TABLO = "secilenPersonellerListesi";
const KAYNAK_SAYFA = "index.html"; // Gün isimlerinin tek kaynağı
let GUNLER = [];
const VARDIYALAR = ["08-20", "20-08", "08-16", "16-24", "24-08"];

/**
 * index.html içindeki vardiya hücrelerinden (data-gun) gün isimlerini sırasıyla okur.
 * @returns {Promise<string[]>} Gün isimleri
 */
async function fetchGunler() {
    const res = await fetch(KAYNAK_SAYFA, { cache: "no-store" });
    if (!res.ok) throw new Error(`${KAYNAK_SAYFA} okunamadı (${res.status})`);

    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const gunler = [];
    doc.querySelectorAll(".vardiya-cell[data-gun]").forEach(cell => {
        const gun = cell.dataset.gun.trim();
        if (!gunler.includes(gun)) gunler.push(gun);
    });
    return gunler;
}

/**
 * Tablo başlıklarındaki gün isimlerini GUNLER'den günceller.
 */
function gunBasliklariniGuncelle() {
    GUNLER.forEach((gun, index) => {
        const th = document.getElementById(`gun${index + 1}Baslik`);
        if (th) th.textContent = gun;
    });
}

/**
 * Son 72 saatteki verileri Supabase'den çeker.
 */
async function fetchLast72hData() {
    const now = new Date();
    const yesterdayIso = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
        .from(HEDEF_TABLO)
        .select("bolum, gun, vardiya")
        .gte('created_at', yesterdayIso);

    if (error) {
        console.error("Veri çekilirken hata:", error);
        return [];
    }
    return data;
}

/**
 * Verileri bölüm, gün ve vardiyaya göre gruplayıp sayar.
 * @param {Array} data Ham veri
 * @returns {Object} Gruplanmış veri
 */
function groupData(data) {
    return data.reduce((acc, { bolum, gun, vardiya }) => {
        if (!bolum || !gun || !vardiya) return acc;

        const bolumKey = bolum.trim();
        const gunKey = gun.trim();
        const vardiyaKey = vardiya.trim();

        if (!acc[bolumKey]) {
            acc[bolumKey] = {};
        }
        if (!acc[bolumKey][gunKey]) {
            acc[bolumKey][gunKey] = {};
        }
        if (!acc[bolumKey][gunKey][vardiyaKey]) {
            acc[bolumKey][gunKey][vardiyaKey] = 0;
        }
        acc[bolumKey][gunKey][vardiyaKey]++;
        return acc;
    }, {});
}

/**
 * Gruplanmış veriyi kullanarak HTML tablosunu oluşturur ve doldurur.
 * @param {Object} groupedData Gruplanmış veri
 */
function renderSummaryTable(groupedData) {
    const tbody = document.getElementById('summaryBody');
    if (!tbody) return;

    const bolumler = Object.keys(groupedData).sort((a, b) => a.localeCompare(b, 'tr'));
    const fragment = document.createDocumentFragment();

    bolumler.forEach(bolum => {
        const tr = document.createElement('tr');

        GUNLER.forEach((gun, index) => {
            // Bölüm adı sütunu
            const tdBolum = document.createElement('td');
            tdBolum.className = 'bolum-col';
            tdBolum.textContent = bolum;
            tr.appendChild(tdBolum);

            // Vardiya sütunları
            VARDIYALAR.forEach(vardiya => {
                const tdCount = document.createElement('td');
                const count = groupedData[bolum]?.[gun]?.[vardiya] || 0;
                tdCount.textContent = count;
                tr.appendChild(tdCount);
            });

            // Günler arası boş sütun
            if (index < GUNLER.length - 1) {
                const tdEmpty = document.createElement('td');
                tdEmpty.className = 'empty-col';
                tr.appendChild(tdEmpty);
            }
        });

        fragment.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

/**
 * Ana fonksiyon: Veriyi çeker, işler ve tabloyu render eder.
 */
async function main() {
    try {
        try {
            GUNLER = await fetchGunler();
        } catch (err) {
            console.error("Gün isimleri okunamadı:", err);
            const uyari = document.getElementById("sunucuUyari");
            if (uyari) uyari.classList.remove("d-none");
            return;
        }
        gunBasliklariniGuncelle();
        const data = await fetchLast72hData();
        const groupedData = groupData(data);
        renderSummaryTable(groupedData);
    } catch (error) {
        console.error("Özet tablosu oluşturulurken bir hata oluştu:", error);
    }
}

document.addEventListener('DOMContentLoaded', main);