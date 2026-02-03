import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Server, KeyRound, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { io } from 'socket.io-client';
import AppHeader from '@/components/AppHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import UsageChart from '@/components/UsageChart';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import api from '@/services/api';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DashboardStats {
  totalProviders: number;
  totalActiveKeys: number;
  requestsToday: number;
  failedKeys: number;
}

interface RecentLog {
  id: string;
  created_at: string;
  model_name: string | null;
  status: string;
  status_code: number | null;
  provider_name?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProviders: 0,
    totalActiveKeys: 0,
    requestsToday: 0,
    failedKeys: 0,
  });
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Enable realtime notifications
  useRealtimeNotifications({ enabled: true });

  useEffect(() => {
    fetchDashboardData();

    const socket = io('http://localhost:3000');
    
    socket.on('logs:insert', () => fetchDashboardData());
    socket.on('providers:update', () => fetchDashboardData());
    socket.on('apikeys:update', () => fetchDashboardData());

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/logs', { params: { limit: 10 } })
      ]);

      setStats(statsRes.data);

      setRecentLogs(
        (logsRes.data.data || []).map((log: any) => ({
          ...log,
          provider_name: log.provider?.name,
        }))
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-success';
    if (status === 'error') return 'text-destructive';
    return 'text-warning';
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Dashboard" subtitle="Ringkasan statistik realtime" />
      
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Provider"
            value={stats.totalProviders}
            icon={Server}
          />
          <StatCard
            title="API Key Aktif"
            value={stats.totalActiveKeys}
            icon={KeyRound}
          />
          <StatCard
            title="Request Hari Ini"
            value={stats.requestsToday}
            icon={Activity}
          />
          <StatCard
            title="API Key Gagal"
            value={stats.failedKeys}
            icon={AlertTriangle}
          />
        </div>

        {/* Usage Chart */}
        <UsageChart />

        {/* Recent Activity */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Aktivitas Terakhir
            </h2>
          </div>
          
          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentLogs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Belum ada aktivitas"
              description="Aktivitas request API akan muncul di sini setelah Anda mulai menggunakan unified API."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), 'dd MMM HH:mm:ss', { locale: idLocale })}
                      </td>
                      <td>{log.provider_name || '-'}</td>
                      <td className="font-mono text-sm">{log.model_name || '-'}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 ${getStatusColor(log.status)}`}>
                          <span className={`w-2 h-2 rounded-full bg-current ${log.status === 'success' ? '' : 'pulse-dot'}`} />
                          {log.status}
                          {log.status_code && <span className="text-muted-foreground">({log.status_code})</span>}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}