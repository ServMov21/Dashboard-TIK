import React, { useEffect, useState } from 'react';
import { Save, Globe, Palette, Clock, HardDrive, FolderTree, Files, Zap, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../utils/api';

// ─── Main Component ──────────────────────────────────────────────────────────
const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('umum');
  const [form, setForm] = useState({
    namaSekolah: '',
    alamat: '',
    baseDir: 'D:\\\\Dashboard_TIK\\\\',
    tema: 'light',
    jamLogout: 60,
    submissionFolderPattern: 'KELAS_ROMBEL/NAMA_TUGAS',
    duplicateFileHandling: 'RENAME_INCREMENT',
    backupDir: '',
    autoBackupEnabled: true,
    autoBackupIntervalSeconds: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Apply theme on component mount and when settings are fetched
  useEffect(() => {
    const savedTheme = localStorage.getItem('tema') || form.tema || 'light';
    applyTheme(savedTheme);
  }, []);

  // Fetch settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await apiRequest('/api/pengaturan');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal memuat pengaturan.');
        setForm(data);
        const themeToApply = localStorage.getItem('tema') || data.tema || 'light';
        applyTheme(themeToApply);
      } catch (e) {
        setError(e.message || 'Gagal memuat pengaturan.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Universal theme application logic
  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-glass');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('tema', theme);
  };

  // Universal form change handler
  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setMessage('');
    setError('');
    if (key === 'tema') {
      applyTheme(value);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await apiRequest('/api/pengaturan', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan pengaturan.');
      setMessage('Pengaturan berhasil disimpan.');
      setForm(prev => ({ ...prev, ...data }));
      applyTheme(form.tema);
    } catch (e) {
      setError(e.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Memuat pengaturan...
      </div>
    );
  }

  const renderTabContent = () => {
    switch(activeTab) {
      case 'xp': return <XpSettingsSection apiRequest={apiRequest} />;
      case 'tampilan': return <TampilanSettingsSection form={form} handleChange={handleChange} />;
      case 'backup': return <BackupSettingsSection form={form} handleChange={handleChange} apiRequest={apiRequest} />;
      default: return <GeneralSettingsSection form={form} handleChange={handleChange} message={message} error={error} handleSave={handleSave} saving={saving} />;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan</h1>
        <p className="text-gray-500 mt-1">Konfigurasi sistem Dashboard Guru TIK</p>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-gray-100">
        <TabButton id="umum" activeTab={activeTab} setActiveTab={setActiveTab} icon={SlidersHorizontal}>Umum</TabButton>
        <TabButton id="tampilan" activeTab={activeTab} setActiveTab={setActiveTab} icon={Palette}>Tampilan & Sistem</TabButton>
        <TabButton id="backup" activeTab={activeTab} setActiveTab={setActiveTab} icon={Files}>Backup & Restore</TabButton>
        <TabButton id="xp" activeTab={activeTab} setActiveTab={setActiveTab} icon={Zap}>XP & Title</TabButton>
      </div>
      
      {renderTabContent()}
    </div>
  );
};

// ─── Tab Button Component ────────────────────────────────────────────────────
const TabButton = ({ id, activeTab, setActiveTab, icon: Icon, children }) => (
  <button
    type="button"
    onClick={() => setActiveTab(id)}
    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition ${
      activeTab === id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <Icon className="w-4 h-4" /> {children}
  </button>
);


// ─── General Settings Section ────────────────────────────────────────────────
const GeneralSettingsSection = ({ form, handleChange, message, error, handleSave, saving }) => (
  <>
    {message && <p className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{message}</p>}
    {error && <p className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</p>}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Identitas Sekolah</h2>
        <div className="space-y-4">
          <Input label="Nama Sekolah" name="namaSekolah" value={form.namaSekolah} onChange={handleChange} placeholder="SMP Negeri ..." />
          <Input label="Alamat Sekolah" name="alamat" value={form.alamat} onChange={handleChange} placeholder="Jl. Pendidikan No. 1..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo Sekolah</label>
            <input type="file" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><HardDrive className="w-5 h-5 text-green-500" /> Konfigurasi Folder Local Disk</h2>
        <div className="space-y-4">
          <Input label="Root Storage Path" name="baseDir" value={form.baseDir} onChange={handleChange} placeholder="D:\\Dashboard_TIK\\" />
          <p className="text-xs text-gray-500 -mt-2">Pastikan path diakhiri dengan double backslash (\\\\) jika di Windows.</p>
        </div>
      </div>
      
       <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><FolderTree className="w-5 h-5 text-orange-500" /> Pola Folder Pengumpulan</h2>
        <div className="space-y-4">
          <Select label="Susunan Folder" name="submissionFolderPattern" value={form.submissionFolderPattern} onChange={handleChange} options={[
            { value: 'KELAS_ROMBEL/NAMA_TUGAS', label: 'KELAS_ROMBEL / NAMA TUGAS' },
            { value: 'NAMA_TUGAS/KELAS_ROMBEL', label: 'NAMA TUGAS / KELAS_ROMBEL' },
          ]} />
          <p className="text-xs text-gray-500 mt-1">Contoh: <code>{form.baseDir}PengumpulanTugas\\5A\\Praktik-Word\\</code></p>
           <Select label="Penanganan File Duplikat" name="duplicateFileHandling" value={form.duplicateFileHandling} onChange={handleChange} options={[
            { value: 'RENAME_INCREMENT', label: 'Rename (file(1).ext)' },
            { value: 'REPLACE', label: 'Replace (timpa file lama)' },
          ]} />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center gap-4">
        <p className="text-sm text-gray-500 text-center">Simpan semua perubahan pengaturan umum.</p>
        <button type="button" onClick={handleSave} disabled={saving} className="w-full max-w-xs py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
          <Save className="w-5 h-5" /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  </>
);

// ─── Tampilan Settings Section ───────────────────────────────────────────────
const TampilanSettingsSection = ({ form, handleChange }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
    <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Palette className="w-5 h-5 text-purple-500" /> Tampilan & Sistem</h2>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tema Aplikasi</label>
        <div className="flex items-center gap-2">
          <ThemeOption name="light" icon="☀️" label="Light" current={form.tema} onChange={handleChange} />
          <ThemeOption name="dark" icon="🌙" label="Dark" current={form.tema} onChange={handleChange} />
          <ThemeOption name="glass" icon="💎" label="Glass" current={form.tema} onChange={handleChange} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Auto Logout (menit)</label>
        <input
          type="number"
          value={form.jamLogout}
          onChange={(e) => handleChange('jamLogout', parseInt(e.target.value, 10))}
          className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="60"
        />
        <p className="text-xs text-gray-500 mt-1">Logout otomatis saat tidak ada aktivitas.</p>
      </div>
    </div>
  </div>
);

const ThemeOption = ({ name, icon, label, current, onChange }) => (
  <button
    onClick={() => onChange('tema', name)}
    className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 ${
      current === name ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
    }`}
  >
    <div className="text-3xl mb-1">{icon}</div>
    <div className={`font-bold ${current === name ? 'text-blue-600' : 'text-gray-700'}`}>{label}</div>
  </button>
);


// ─── XP Settings Section ──────────────────────────────────────────────────────
const XpSettingsSection = ({ apiRequest: api }) => {
  const [xpForm, setXpForm] = useState({
    xpBase: 80, xpNilai70: 20, xpNilai80: 40, xpNilai90: 70, xpNilai100: 100,
    xpEarly: 25, xpPerfect: 70, xpBonusMax: 20, xpPenaltiTidakKumpul: -50,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/api/xp/settings').then(r => r.json()).then(d => {
      if (d && !d.message) setXpForm(p => ({ ...p, ...d }));
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await api('/api/xp/settings', { method: 'PUT', body: JSON.stringify(xpForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg('Pengaturan XP berhasil disimpan.');
    } catch (e) { setMsg('Gagal: ' + e.message); }
    finally { setSaving(false); }
  };

  const fields = [
    { key:'xpBase', label:'Base XP (mengumpulkan)', desc:'Diterima saat siswa submit' },
    { key:'xpNilai70', label:'Bonus Nilai 70–79', desc:'Tambahan XP' },
    { key:'xpNilai80', label:'Bonus Nilai 80–89', desc:'Tambahan XP' },
    { key:'xpNilai90', label:'Bonus Nilai 90–99', desc:'Tambahan XP' },
    { key:'xpNilai100', label:'Bonus Nilai 100', desc:'Tambahan XP' },
    { key:'xpEarly', label:'Early Submission', desc:'Kumpul sebelum deadline' },
    { key:'xpPerfect', label:'Perfect Score Bonus', desc:'Jika nilai = 100' },
    { key:'xpBonusMax', label:'Maks Bonus Guru', desc:'Batas bonus manual' },
    { key:'xpPenaltiTidakKumpul', label:'Penalti Tidak Kumpul', desc:'Saat tugas ditutup', negative: true },
  ];

  const exNilai = xpForm.xpNilai90;
  const exEarly = xpForm.xpEarly;
  const exTotal = xpForm.xpBase + exNilai + exEarly;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold text-gray-800 mb-1">⚡ Konfigurasi XP & Title</h2>
      <p className="text-sm text-gray-500 mb-6">Atur poin XP yang diperoleh siswa untuk setiap komponen penilaian.</p>
      {msg && <p className={`mb-4 p-3 rounded-xl text-sm ${msg.startsWith('Gagal') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {fields.map(f => (
          <label key={f.key} className="block text-sm font-medium text-gray-700">
            {f.label}
            <span className="block text-xs text-gray-400 mb-1">{f.desc}</span>
            <div className="flex items-center gap-1">
              <input type="number" {...(f.negative ? {} : { min: 0 })} step={1} value={xpForm[f.key]}
                onChange={e => setXpForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                className={`w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold ${f.negative ? 'text-red-600' : ''}`} />
              <span className="text-xs text-gray-400 shrink-0">XP</span>
            </div>
          </label>
        ))}
      </div>
      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700 mb-4 border border-blue-100">
        <p className="font-semibold mb-1">📊 Contoh Kalkulasi XP:</p>
        <p>Base ({xpForm.xpBase}) + Nilai 90-99 ({exNilai}) + Early Submission ({exEarly}) = <strong className="text-blue-800">{exTotal} XP</strong></p>
        <p className="mt-1 text-blue-600">Max Perfect: {xpForm.xpBase + xpForm.xpNilai100 + xpForm.xpEarly + xpForm.xpPerfect} XP</p>
        <p className="mt-1 text-red-600">Tidak kumpul = {xpForm.xpPenaltiTidakKumpul} XP</p>
      </div>
      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition">
        <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan XP'}
      </button>
    </div>
  );
};

// ─── Generic Form Components ─────────────────────────────────────────────────
const Input = ({ label, name, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
      placeholder={placeholder}
    />
  </div>
);

const Select = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);


const BackupSettingsSection = ({ form, handleChange, apiRequest }) => {
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage('');
    setBackupError('');
    try {
      const res = await apiRequest('/api/backup/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat backup.');
      setBackupMessage(`Backup berhasil dibuat: ${data.file}`);
    } catch (e) {
      setBackupError(e.message || 'Gagal membuat backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      setBackupError('Pilih file backup untuk direstore.');
      return;
    }

    if (!confirm('ANDA YAKIN INGIN MERESTORE? Ini akan menimpa seluruh database dan file storage. Harap pastikan Anda memiliki backup terbaru!')) {
      return;
    }

    setIsRestoring(true);
    setBackupMessage('');
    setBackupError('');
    try {
      const formData = new FormData();
      formData.append('backupFile', restoreFile);

      const res = await apiRequest('/api/backup/restore', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': undefined, // Let browser set Content-Type with boundary
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal merestore backup.');
      setBackupMessage('Restore berhasil! Aplikasi akan memuat ulang.');
      setTimeout(() => window.location.reload(), 2000); // Reload to reflect DB changes
    } catch (e) {
      setBackupError(e.message || 'Gagal merestore backup.');
    } finally {
      setIsRestoring(false);
      setRestoreFile(null);
    }
  };

  return (
    <div className="space-y-8">
      {backupMessage && <p className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{backupMessage}</p>}
      {backupError && <p className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{backupError}</p>}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Files className="w-5 h-5 text-blue-500" /> Backup Data</h2>
        <div className="space-y-4">
          <Input 
            label="Folder Tujuan Backup" 
            name="backupDir" 
            value={form.backupDir} 
            onChange={handleChange} 
            placeholder="C:\\Dashboard_TIK_Backup" 
          />
          <Switch 
            label="Aktifkan Auto-Backup" 
            name="autoBackupEnabled" 
            checked={form.autoBackupEnabled} 
            onChange={handleChange} 
            description="Secara otomatis membuat backup berkala." 
          />
          {form.autoBackupEnabled && (
            <Input 
              label="Interval Auto-Backup (detik)" 
              name="autoBackupIntervalSeconds" 
              type="number"
              value={form.autoBackupIntervalSeconds} 
              onChange={handleChange} 
              placeholder="3600" 
              description="Contoh: 3600 detik = 1 jam."
            />
          )}
          <button 
            onClick={handleCreateBackup} 
            disabled={isBackingUp}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 mt-6"
          >
            {isBackingUp ? 'Membuat Backup...' : 'Buat Backup Sekarang'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-red-500" /> Restore Data</h2>
        <div className="space-y-4">
          <FileInput 
            label="Pilih File Backup (.zip)" 
            onChange={setRestoreFile} 
            accept=".zip" 
            currentFile={restoreFile}
          />
          <button 
            onClick={handleRestore} 
            disabled={isRestoring || !restoreFile}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition shadow-lg shadow-red-200 flex items-center justify-center gap-2 mt-6"
          >
            {isRestoring ? 'Merestore...' : 'Restore dari Backup'}
          </button>
          <p className="text-sm text-red-700 mt-4 p-2 bg-red-50 border border-red-200 rounded-lg">
            <strong>PERINGATAN:</strong> Proses restore akan menimpa seluruh data aplikasi Anda dengan data dari file backup. Pastikan Anda telah membuat backup terbaru sebelum melanjutkan.
          </p>
        </div>
      </div>
    </div>
  );
};

const Switch = ({ label, name, checked, onChange, description }) => (
  <label className="flex items-center cursor-pointer justify-between">
    <div>
      <span className="text-sm font-medium text-gray-700 block">{label}</span>
      {description && <span className="text-xs text-gray-500">{description}</span>}
    </div>
    <div className="relative">
      <input
        type="checkbox"
        name={name}
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(name, e.target.checked)}
      />
      <div className={`block w-14 h-8 rounded-full ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'translate-x-full' : ''}`}></div>
    </div>
  </label>
);

const FileInput = ({ label, onChange, accept, currentFile }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="file"
      accept={accept}
      onChange={(e) => onChange(e.target.files[0])}
      className="w-full text-sm text-gray-500
        file:mr-4 file:py-2 file:px-4
        file:rounded-full file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-50 file:text-blue-700
        hover:file:bg-blue-100"
    />
    {currentFile && (
      <p className="text-xs text-gray-500 mt-2">File terpilih: {currentFile.name}</p>
    )}
  </div>
);

export default SettingsPage;