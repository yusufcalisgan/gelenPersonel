// Supabase bağlantı bilgileri
const SUPABASE_URL = "https://igbdsssdcnteybawxfqj.supabase.co";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYmRzc3NkY250ZXliYXd4ZnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDA5NDIsImV4cCI6MjA3MTUxNjk0Mn0.mItvF3JMdV3-MByhrTRNmTLgy5v9ypp4ks8SmGlTY3E";
// Global nesneyi gölgelememek için farklı bir değişken adı kullan
const sb = window.supabase.createClient(SUPABASE_URL, API_KEY);

// Uygulama başlangıcında anonim oturum açmayı dene (RLS için gerekebilir)
(async () => {
    try {
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) {
            try {
                await sb.auth.signInAnonymously();
            } catch (err) {
                // Provider kapalıysa 422 dönebilir; burada sessizce geçiyoruz
                console.warn("Anonim oturum açılamadı (yok sayıldı):", err?.message || err);
            }
        }
    } catch (e) {
        console.error("Anonim oturum açılırken hata:", e);
    }
})();

// Tablo adları
const KAYNAK_TABLO = "personelVeriGirisi"; // Listeleme yapılacak tablo
const HEDEF_TABLO = "secilenPersonellerListesi"; // Seçimler yazılacak tablo

// Modal ve liste elemanlarını seç (index14'te mevcut, index15'te yok)
const personelModalEl = document.getElementById('personelModal');
const personelModal = personelModalEl && window.bootstrap ? new bootstrap.Modal(personelModalEl) : null;
const personelListesi = document.getElementById('personelListesi');
let aktifVardiyaHucresi = null; // Tıklanan hücreyi tutacak değişken

// Bütün vardiya hücrelerine tıklama olayı ekle
document.querySelectorAll(".vardiya-cell").forEach(cell => {
    cell.addEventListener("click", () => {
        const bolum = document.getElementById("bolumSecimi").value;
        if (!bolum) {
            alert("Lütfen önce bir bölüm seçiniz.");
            return;
        }
        
        // Önceki aktif hücre varsa pasif yap
        if (aktifVardiyaHucresi) {
            aktifVardiyaHucresi.classList.remove("active");
        }
        
        // Şu anki hücreyi aktif yap
        aktifVardiyaHucresi = cell;
        aktifVardiyaHucresi.classList.add("active");

        fetchPersonelListesi(bolum);
    });
});

// Supabase'den personel listesini çekecek fonksiyon
async function fetchPersonelListesi(bolum) {
    if (!personelListesi) return; // Modal yoksa işlem yapma
    const { data: personelData, error } = await sb
        .from(KAYNAK_TABLO)
        .select('*')
        .eq('bolum', bolum); // Bölüm adıyla filtreleme

    if (error) {
        console.error("Personel verileri çekilirken hata:", error);
        alert("Personel listesi yüklenirken bir sorun oluştu.");
        return;
    }

    // Modal içini temizle ve yeni listeyi oluştur
    personelListesi.innerHTML = '';
    if (personelData.length === 0) {
        personelListesi.innerHTML = '<li class="list-group-item disabled">Bu bölüme ait personel bulunamadı.</li>';
        if (personelModal) personelModal.show();
        return;
    }
    
    personelData.forEach(personel => {
        const li = document.createElement("li");
        li.className = "list-group-item";
        const adSoyad = personel.adSoyad || personel.isim || personel.ad_soyad || personel.adsoyad || [personel.ad, personel.soyad].filter(Boolean).join(' ') || "İsimsiz";
        li.textContent = adSoyad;
        if (personel.durak) {
            li.dataset.durak = personel.durak;
        }
        if (personel.ilce) {
            li.dataset.ilce = personel.ilce;
        }
        
        li.addEventListener("click", () => {
            // Tıklandığında aktif/pasif hale getir ve rengini değiştir
            li.classList.toggle("active");
        });
        
        personelListesi.appendChild(li);
    });
    
    // Personel listesi hazır olunca modalı göster
    if (personelModal) personelModal.show();
}

// Geçici veri saklama için global değişken
let tempPersonelData = [];

// Modal penceresindeki "Kaydet" butonuna tıklama olayı
const modalKaydetBtn = document.getElementById("modalKaydet");
if (modalKaydetBtn) modalKaydetBtn.addEventListener("click", () => {
    // Tıklanan ve personel seçilen hücreyi al
    const aktifCell = document.querySelector(".vardiya-cell.active");
    if (!aktifCell) {
        alert("Lütfen önce personel seçimi yapılacak hücreye tıklayın.");
        return;
    }

    // Modal içindeki 'active' class'ına sahip personelleri bulalım
    const seciliPersoneller = Array.from(personelListesi.querySelectorAll(".active"))
                                   .map(li => ({
                                       adSoyad: li.textContent.trim(),
                                       durak: li.dataset.durak || null,
                                       ilce: li.dataset.ilce || null
                                   }));

    // Seçilen personel sayısı 0 ise uyarı ver
    if (seciliPersoneller.length === 0) {
        alert("Lütfen en az bir personel seçiniz.");
        return;
    }

    // Vardiya hücresine seçilen personel sayısını yaz
    aktifCell.textContent = seciliPersoneller.length;
    
    // Hücredeki 'active' class'ını kaldır ve rengini normale döndür
    aktifCell.classList.remove("active"); 

    // Geçici veriye ekle (Supabase'e henüz kaydetme)
    for (const personel of seciliPersoneller) {
        const data = {
            adSoyad: personel.adSoyad,
            gun: aktifCell.dataset.gun,
            vardiya: aktifCell.dataset.vardiya,
            bolum: document.getElementById("bolumSecimi").value,
            ...(personel.durak ? { durak: personel.durak } : {}),
            ...(personel.ilce ? { ilce: personel.ilce } : {})
        };
        tempPersonelData.push(data);
    }
    
    // İşlem bitince modal penceresini kapat
    if (personelModal) personelModal.hide();
});

// Gönder butonuna basıldığında tüm geçici verileri Supabase'e gönderme
const gonderBtn = document.getElementById("gonderBtn");
if (gonderBtn) gonderBtn.addEventListener("click", async () => {
    if (tempPersonelData.length === 0) {
        alert("Gönderilecek veri bulunamadı. Lütfen önce personel seçimi yapın.");
        return;
    }
    
    try {
        // Tüm geçici verileri Supabase'e gönder
        const { error } = await sb.from(HEDEF_TABLO).insert(tempPersonelData);
        
        if (error) {
            console.error("Veriler gönderilirken hata:", error);
            alert("Veriler gönderilirken bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
            return;
        }
        
        // Başarılı gönderim sonrası geçici veriyi temizle
        tempPersonelData = [];
        
        // Tüm vardiya hücrelerini sıfırla
        document.querySelectorAll(".vardiya-cell").forEach(cell => {
            cell.textContent = "0";
        });
        
        alert("Başarıyla Veriler Gönderildi!");
    } catch (err) {
        console.error("Gönderim sırasında hata:", err);
        alert("Gönderim sırasında bir hata oluştu: " + err.message);
    }
});

// Temizle butonuna basıldığında tüm verileri temizle ve sayfayı yenile
const temizleBtn = document.getElementById("temizleBtn");
if (temizleBtn) temizleBtn.addEventListener("click", () => {
    if (confirm("Tüm veriler temizlenecek ve sayfa yenilenecek. Devam etmek istiyor musunuz?")) {
        // Geçici veriyi temizle
        tempPersonelData = [];
        
        // Tüm vardiya hücrelerini sıfırla
        document.querySelectorAll(".vardiya-cell").forEach(cell => {
            cell.textContent = "0";
        });
        
        // Bölüm seçimini sıfırla
        const bolumSecimi = document.getElementById("bolumSecimi");
        if (bolumSecimi) {
            bolumSecimi.value = "";
        }
        
        // Sayfayı yenile
        location.reload();
    }
});

// Son 24 saatte eklenen kayıtları getirip normalize eden yardımcı fonksiyon
async function fetchLast24hNormalizedSorted() {
        const now = new Date();
        const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        let data = [];
            let query = sb.from(HEDEF_TABLO).select("*");
            try {
                const res = await query.gte('created_at', yesterdayIso);
                if (res.error && res.error.code === '42703') {
            // created_at yoksa tümünü çek ve client-side filtrele
                    const resAll = await sb.from(HEDEF_TABLO).select("*");
                    if (resAll.error) throw resAll.error;
                    data = (resAll.data || []).filter(r => {
                        const ts = r.created_at || r.createdAt || r.inserted_at || r.insertedAt;
                        return ts ? new Date(ts).getTime() >= (now.getTime() - 24 * 60 * 60 * 1000) : true;
                    });
                } else if (res.error) {
                    throw res.error;
                } else {
                    data = res.data || [];
                }
            } catch (err) {
        throw err;
    }

    const normalized = (data || []).map((r) => ({
        adSoyad: r.adSoyad || r.isim || "",
        bolum: r.bolum || "",
        durak: r.durak || "",
        gun: r.gun || "",
        vardiya: r.vardiya || "",
        ilce: r.ilce || "",
        createdAt: r.created_at || r.createdAt || r.inserted_at || r.insertedAt || null
    }));

    normalized.sort((a, b) => {
        const getIlceOrder = (ilce) => {
            const ilceStr = (ilce || '').toLowerCase();
            if (ilceStr.toLowerCase() === 'çerkezköy') return 0;
            if (ilceStr.toLowerCase() === 'kapaklı') return 1;
            return 2; // Diğer ilçeler
        };

        const orderA = getIlceOrder(a.ilce);
        const orderB = getIlceOrder(b.ilce);
        if (orderA !== orderB) return orderA - orderB;

        // Aynı ilçe grubu içindeyse, ilçe adına göre alfabetik sırala
        const ilceA = (a.ilce || "").toLocaleLowerCase('tr');
        const ilceB = (b.ilce || "").toLocaleLowerCase('tr');
        if (ilceA.localeCompare(ilceB, 'tr') !== 0) return ilceA.localeCompare(ilceB, 'tr');

        // İlçe aynıysa, güne göre sırala
        const ag = (a.gun || "").localeCompare(b.gun || "", 'tr');
        if (ag !== 0) return ag;
        // Gün aynıysa, vardiyaya göre sırala
        const av = (a.vardiya || "").localeCompare(b.vardiya || "", 'tr');
        if (av !== 0) return av;
        // Vardiya aynıysa, durağa göre sırala
        const ad = (a.durak || "").localeCompare(b.durak || "", 'tr');
        if (ad !== 0) return ad;
        // Son olarak bölüme göre sırala
        const bolumA = (a.bolum || "").localeCompare(b.bolum || "", 'tr');
        if (bolumA !== 0) return bolumA;

        // En son oluşturulma tarihine göre sırala
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return at - bt;
    });

    return normalized;
}

// HTML tabloyu doldur
async function loadAndRenderTable() {
    const table = document.getElementById('recordsTable');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
        const normalized = await fetchLast24hNormalizedSorted();
        renderSummaryTable(normalized); // Özet tabloyu doldurma fonksiyonunu çağır
        const fragment = document.createDocumentFragment();
        let currentIlce = null;
        let currentGun = null;
        let currentVardiya = null;
        let colorIndex = 0;
        const dayClasses = [
            'table-primary',
            'table-success',
            'table-warning',
            'table-info',
            'table-secondary'
        ];
        for (const it of normalized) {
            // İlçe değişimlerinde ana grup başlığı ekle
            const normalizedIlce = (it.ilce || "").toLocaleLowerCase('tr');
            const currentNormalizedIlce = (currentIlce || "").toLocaleLowerCase('tr');

            if (normalizedIlce !== currentNormalizedIlce) {
                currentIlce = it.ilce; // Orijinal büyük/küçük harfli halini sakla
                currentGun = null; // Alt grupları sıfırla
                currentVardiya = null;
                const sepTr = document.createElement('tr');
                sepTr.className = 'table-dark'; // Ana grup için belirgin bir stil
                const sepTh = document.createElement('th');
                sepTh.setAttribute('colspan', '7');
                sepTh.className = 'text-center';
                sepTh.style.fontSize = '1.1rem';
                sepTh.textContent = `İlçe: ${currentIlce || 'Diğer'}`;
                sepTr.appendChild(sepTh);
                fragment.appendChild(sepTr);
            }

            if (it.gun !== currentGun) {
                currentGun = it.gun;
                currentVardiya = null;
                const sepTr = document.createElement('tr');
                const cls = dayClasses[colorIndex % dayClasses.length];
                sepTr.className = cls;
                const sepTh = document.createElement('th');
                sepTh.setAttribute('colspan', '7');
                sepTh.className = 'text-start';
                sepTh.textContent = `Gün: ${currentGun || '-'}`;
                sepTr.appendChild(sepTh);
                fragment.appendChild(sepTr);
                colorIndex += 1;
            }
            // Vardiya değişimlerinde ayraç ekle
            if (currentVardiya !== null && it.vardiya !== currentVardiya) {
                const vSepTr = document.createElement('tr');
                const vSepTh = document.createElement('th');
                vSepTh.setAttribute('colspan', '7');
                vSepTh.className = 'text-center';
                vSepTh.style.padding = '4px 8px';
                vSepTh.style.backgroundColor = '#e9ecef';
                vSepTh.style.borderTop = '2px solid #6c757d';
                vSepTh.style.borderBottom = '1px solid #dee2e6';
                vSepTh.style.fontWeight = '500';
                vSepTh.style.fontSize = '0.9rem';
                vSepTh.textContent = `Vardiya: ${it.vardiya || '-'}`;
                vSepTr.appendChild(vSepTh);
                fragment.appendChild(vSepTr);
            }
            currentVardiya = it.vardiya;
            const tr = document.createElement('tr');
            const tdGun = document.createElement('td'); tdGun.textContent = it.gun;
            const tdVardiya = document.createElement('td'); tdVardiya.textContent = it.vardiya;
            const tdDurak = document.createElement('td'); tdDurak.textContent = it.durak;
            const tdIlce = document.createElement('td'); tdIlce.textContent = it.ilce || '';
            const tdAdSoyad = document.createElement('td'); tdAdSoyad.textContent = it.adSoyad;
            const tdBolum = document.createElement('td'); tdBolum.textContent = it.bolum;
            const tdCreated = document.createElement('td'); tdCreated.textContent = it.createdAt ? new Date(it.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '';
            tr.appendChild(tdGun);
            tr.appendChild(tdVardiya);
            tr.appendChild(tdDurak);
            tr.appendChild(tdIlce);
            tr.appendChild(tdAdSoyad);
            tr.appendChild(tdBolum);
            tr.appendChild(tdCreated);
            fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
    } catch (err) {
        console.error('Tablo verileri yüklenirken hata:', err);
    }
}

// Özet tabloyu oluşturan fonksiyon
function renderSummaryTable(data) {
    const summaryTable = document.getElementById('summaryTable');
    if (!summaryTable) return;
    const tbody = summaryTable.querySelector('tbody');
    if (!tbody) return;

    // Verileri bölüm, gün ve vardiyaya göre grupla ve say
    const summary = data.reduce((acc, curr) => {
        const key = `${curr.bolum}|${curr.gun}|${curr.vardiya}`;
        if (!acc[key]) {
            acc[key] = {
                bolum: curr.bolum,
                gun: curr.gun,
                vardiya: curr.vardiya,
                count: 0
            };
        }
        acc[key].count++;
        return acc;
    }, {});

    // Gruplanmış verileri tabloya ekle
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    Object.values(summary).forEach(item => {
        const tr = document.createElement('tr');
        const tdBolum = document.createElement('td'); tdBolum.textContent = item.bolum;
        const tdGun = document.createElement('td'); tdGun.textContent = item.gun;
        const tdVardiya = document.createElement('td'); tdVardiya.textContent = item.vardiya;
        const tdCount = document.createElement('td'); tdCount.textContent = item.count;
        tr.append(tdBolum, tdGun, tdVardiya, tdCount);
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

// Son 24 saatte eklenen kayıtları PDF'e aktar
async function handlePdfDownload() {
    try {
        const normalized = await fetchLast24hNormalizedSorted();
        if (normalized.length === 0) {
            alert("PDF oluşturmak için veri bulunamadı.");
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF oluşturma kütüphanesi (jsPDF) yüklenemedi. Lütfen sayfayı yenileyin.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Gelecek Personellerin Listesi", 14, 16);

        const tableBody = [];
        let currentIlce = null;
        let currentGun = null;
        let currentVardiya = null;
        let colorIndex = 0;
        const dayColors = [
            [222, 235, 255], // table-primary
            [213, 245, 227], // table-success
            [255, 243, 205], // table-warning
            [207, 244, 252], // table-info
            [231, 233, 235]  // table-secondary
        ];

        normalized.forEach(it => {
            // İlçe ayraç satırı
            if (it.ilce !== currentIlce) {
                currentIlce = it.ilce;
                currentGun = null; // Alt grupları sıfırla
                currentVardiya = null;
                tableBody.push([{
                    content: `İlçe: ${currentIlce || 'Diğer'}`,
                    colSpan: 7,
                    styles: { fillColor: [52, 58, 64], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 11 }
                }]);
            }

            // Gün ayraç satırı
            if (it.gun !== currentGun) {
                currentGun = it.gun;
                currentVardiya = null;
                const color = dayColors[colorIndex % dayColors.length];
                colorIndex++;
                tableBody.push([{
                    content: `Gün: ${currentGun || '-'}`,
                    colSpan: 7,
                    styles: { fillColor: color, textColor: 20, fontStyle: 'bold', halign: 'left' }
                }]);
            }

            // Vardiya ayraç satırı
            if (it.vardiya !== currentVardiya) {
                currentVardiya = it.vardiya;
                tableBody.push([{
                    content: `Vardiya: ${it.vardiya || '-'}`,
                    colSpan: 7,
                    styles: { fillColor: [233, 236, 239], textColor: 20, fontStyle: 'bold', halign: 'center' }
                }]);
            }

            // Personel veri satırı
            tableBody.push([
                it.gun, it.vardiya, it.durak, it.ilce || "", it.adSoyad, it.bolum,
                it.createdAt ? new Date(it.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : ""
            ]);
        });

        doc.autoTable({
            head: [["Gün", "Vardiya", "Durak", "İlçe", "Ad Soyad", "Bölüm", "Oluşturulma"]],
            body: tableBody,
            startY: 22,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        });

        doc.save("Gelecek_Personeller_Listesi.pdf");
    } catch (e) {
        console.error("PDF oluşturulurken bir hata oluştu:", e);
        alert("PDF oluşturulurken bir hata oluştu: " + e.message);
    }
}

const pdfBtnEl = document.getElementById("pdfBtn");
if (pdfBtnEl) pdfBtnEl.addEventListener("click", handlePdfDownload);

document.addEventListener('DOMContentLoaded', () => {
    // Sayfa yüklendiğinde tabloyu doldur
    loadAndRenderTable();
});
