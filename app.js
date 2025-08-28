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
        
        li.addEventListener("click", () => {
            // Tıklandığında aktif/pasif hale getir ve rengini değiştir
            li.classList.toggle("active");
        });
        
        personelListesi.appendChild(li);
    });
    
    // Personel listesi hazır olunca modalı göster
    if (personelModal) personelModal.show();
}

// Modal penceresindeki "Kaydet" butonuna tıklama olayı
const modalKaydetBtn = document.getElementById("modalKaydet");
if (modalKaydetBtn) modalKaydetBtn.addEventListener("click", async () => {
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
                                       durak: li.dataset.durak || null
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

    // Her bir seçilen personel için veritabanına kayıt işlemi yap
    for (const personel of seciliPersoneller) {
        const data = {
            adSoyad: personel.adSoyad,
            gun: aktifCell.dataset.gun,
            vardiya: aktifCell.dataset.vardiya,
            bolum: document.getElementById("bolumSecimi").value,
            ...(personel.durak ? { durak: personel.durak } : {})
        };

        // Supabase'ye POST isteği gönder
        const { error } = await sb.from(HEDEF_TABLO).insert([data]);
        
        // Hata kontrolü
        if (error) {
            console.error("Seçilen personel kaydedilirken hata:", error);
            alert("Personel kaydı sırasında bir hata oluştu: " + (error.message || "Bilinmeyen hata") + "\nLütfen tablonun RLS politikalarının eklemeye izin verdiğini doğrulayın.");
            break; // Hata durumunda döngüden çık
        }
    }
    
    // İşlem bitince modal penceresini kapat
    if (personelModal) personelModal.hide();
    alert("Personeller başarıyla kaydedildi.");
});

// Gönder butonuna basıldığında tüm verileri Supabase'e gönderme ve 3 dakika bekleme süresi (sadece index14'te mevcut)
const gonderBtn = document.getElementById("gonderBtn");
if (gonderBtn) gonderBtn.addEventListener("click", async () => {
    // Bu kısım, tüm verilerinizi Supabase'e gönderecek.
    // İlk cevabımızda bu işlemi tamamlamıştık.
    // Lütfen buraya kendi Supabase gönderme mantığınızı tekrar ekleyin.
    // Örneğin:
    // await sendDataToSupabase();
});

// Son 24 saatte eklenen kayıtları PDF'e aktar
async function handlePdfDownload() {
    try {
        const now = new Date();
        const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // created_at varsa sunucuda filtrele; yoksa client-side filtre uygula
        let data = [];
        {
            let query = sb.from(HEDEF_TABLO).select("*");
            try {
                const res = await query.gte('created_at', yesterdayIso);
                if (res.error && res.error.code === '42703') {
                    // created_at kolonu yok → tümünü çek ve client-side filtrele
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
                console.error("PDF verileri alınırken hata:", err);
                alert("PDF için veriler çekilirken bir hata oluştu: " + (err.message || ""));
                return;
            }
        }

        const rows = (data || []).map((r, i) => [
            i + 1,
            r.adSoyad || r.isim || "",
            r.bolum || "",
            r.durak || "",
            r.gun || "",
            r.vardiya || "",
            (() => {
                const ts = r.created_at || r.createdAt || r.inserted_at || r.insertedAt;
                return ts ? new Date(ts).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : "";
            })()
        ]);

        if (!window.jspdf) {
            alert("jsPDF yüklenemedi. Lütfen sayfayı yenileyin.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("Son 24 Saatte Kaydedilen Personeller", 14, 16);

        if (doc.autoTable) {
            doc.autoTable({
                head: [["#", "Ad Soyad", "Bölüm", "Durak", "Gün", "Vardiya", "Oluşturulma"]],
                body: rows,
                startY: 22
            });
        } else {
            // AutoTable yoksa basit liste
            let y = 24;
            rows.forEach(r => {
                doc.text(r.join(" | "), 14, y);
                y += 8;
            });
        }

        doc.save("son24saat_secilen_personeller.pdf");
    } catch (e) {
        console.error(e);
        alert("PDF oluşturulurken bir hata oluştu.");
    }
}

const pdfBtnEl = document.getElementById("pdfBtn");
if (pdfBtnEl) pdfBtnEl.addEventListener("click", handlePdfDownload);
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('pdfBtn');
  if (b) b.addEventListener('click', handlePdfDownload);
});