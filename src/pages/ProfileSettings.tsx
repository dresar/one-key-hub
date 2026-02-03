import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Shield, Loader2, Save } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import api from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import bcrypt from 'bcryptjs';

interface RotationSettings {
  id: string;
  strategy: string;
  fallback_enabled: boolean;
}

export default function ProfileSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile form
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Rotation settings
  const [rotationSettings, setRotationSettings] = useState<RotationSettings | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch user data
      if (user) {
        setUsername(user.username);
      }

      // Fetch rotation settings
      const { data: settings } = await api.get('/settings/rotation');
      
      if (settings) {
        setRotationSettings(settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error('Username tidak boleh kosong');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Password baru tidak cocok');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = { username };

      if (newPassword) {
        // In a real app, verify old password on server
        // But here we might just send it and let server verify
        updates.currentPassword = currentPassword;
        updates.newPassword = newPassword;
      }

      await api.put('/users/profile', updates);
      
      toast.success('Profil berhasil diperbarui');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.error || 'Gagal memperbarui profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRotation = async () => {
    if (!rotationSettings) return;

    setIsSaving(true);
    try {
      await api.put('/settings/rotation', {
        strategy: rotationSettings.strategy,
        fallback_enabled: rotationSettings.fallback_enabled,
      });

      toast.success('Pengaturan rotasi berhasil diperbarui');
    } catch (error) {
      console.error('Error updating rotation settings:', error);
      toast.error('Gagal memperbarui pengaturan');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Profil & Pengaturan" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader title="Profil & Pengaturan" subtitle="Kelola akun dan konfigurasi sistem" />
      
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column - Profile */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-6 h-full"
            >
              <h2 className="font-semibold flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                Profil Admin
              </h2>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>

                <Separator className="my-6" />

                <h3 className="text-sm font-medium text-muted-foreground mb-4">Ubah Password</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Password Saat Ini</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-secondary/50"
                      placeholder="Masukkan password saat ini"
                    />
                  </div>
                  <div className="hidden md:block"></div> {/* Spacer */}

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Password Baru</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-secondary/50"
                      placeholder="Masukkan password baru"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-secondary/50"
                      placeholder="Ulangi password baru"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 w-full md:w-auto">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Simpan Perubahan
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>

          {/* Side Column - Settings & Info */}
          <div className="space-y-6">
            {/* Rotation Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-6"
            >
              <h2 className="font-semibold flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-primary" />
                Pengaturan Rotasi
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Strategi Rotasi</Label>
                  <Select
                    value={rotationSettings?.strategy || 'per_provider'}
                    onValueChange={(value) => 
                      setRotationSettings(prev => prev ? { ...prev, strategy: value } : null)
                    }
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_provider">Per Provider</SelectItem>
                      <SelectItem value="global">Global (Semua Provider)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-medium">Per Provider:</span> Rotasi API key dalam satu provider dulu.<br />
                    <span className="font-medium">Global:</span> Rotasi semua API key dari semua provider.
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Fallback Otomatis</Label>
                    <p className="text-xs text-muted-foreground">
                      Pindah provider jika gagal
                    </p>
                  </div>
                  <Switch
                    checked={rotationSettings?.fallback_enabled ?? true}
                    onCheckedChange={(checked) =>
                      setRotationSettings(prev => prev ? { ...prev, fallback_enabled: checked } : null)
                    }
                  />
                </div>

                <Button
                  onClick={handleUpdateRotation}
                  disabled={isSaving}
                  className="w-full bg-primary hover:bg-primary/90"
                  variant="outline"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Pengaturan
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* System Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-6"
            >
              <h2 className="font-semibold flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-primary" />
                Informasi Sistem
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                  <span className="text-muted-foreground">Versi</span>
                  <span className="font-mono">1.0.0</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-500 font-medium">Production</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                  <span className="text-muted-foreground">Database</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-500 font-medium flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
