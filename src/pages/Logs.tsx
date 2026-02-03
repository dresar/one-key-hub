import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Filter, Loader2, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/services/api';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Log {
  id: string;
  created_at: string;
  model_name: string | null;
  request_path: string | null;
  status: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  tokens_used: number | null;
  provider_name?: string;
  api_key_name?: string;
}

const ITEMS_PER_PAGE = 20;

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchLogs();

    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      console.log('Connected to socket server for logs');
    });

    socket.on('logs:insert', (newLog: Log) => {
      setLogs(prev => [newLog, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [statusFilter, page]);

  const fetchLogs = async () => {
    try {
      const params: any = {
        page: page + 1, // API usually 1-based
        limit: ITEMS_PER_PAGE,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      const response = await api.get('/logs', { params });
      const { data, total } = response.data; // Assuming API returns { data: [], total: number }

      const formattedLogs = (data || []).map((log: any) => ({
        ...log,
        provider_name: log.provider?.name,
        api_key_name: log.api_key?.name,
      }));

      if (page === 0) {
        setLogs(formattedLogs);
      } else {
        setLogs(prev => [...prev, ...formattedLogs]);
      }

      setHasMore(formattedLogs.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setPage(0);
    setIsLoading(true);
    fetchLogs();
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(0);
    setLogs([]);
    setIsLoading(true);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.model_name?.toLowerCase().includes(query) ||
      log.provider_name?.toLowerCase().includes(query) ||
      log.error_message?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-success';
    if (status === 'error') return 'text-destructive';
    return 'text-warning';
  };

  const getStatusBgColor = (status: string) => {
    if (status === 'success') return 'bg-success/10';
    if (status === 'error') return 'bg-destructive/10';
    return 'bg-warning/10';
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Log Aktivitas" subtitle="Histori request dan monitoring error" />
      
      <div className="p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                placeholder="Cari log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary/50 pl-10"
              />
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px] bg-secondary/50">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Logs Table */}
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass rounded-xl">
            <EmptyState
              icon={ScrollText}
              title="Belum ada log"
              description="Log aktivitas akan muncul di sini setelah ada request ke unified API."
            />
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Tokens</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <td className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd MMM HH:mm:ss', { locale: idLocale })}
                      </td>
                      <td>{log.provider_name || '-'}</td>
                      <td className="font-mono text-sm">{log.model_name || '-'}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${getStatusBgColor(log.status)} ${getStatusColor(log.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full bg-current ${log.status === 'pending' ? 'animate-pulse' : ''}`} />
                          {log.status}
                          {log.status_code && <span className="opacity-70">({log.status_code})</span>}
                        </span>
                      </td>
                      <td className="text-sm">
                        {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                      </td>
                      <td className="text-sm">
                        {log.tokens_used || '-'}
                      </td>
                      <td className="text-sm text-destructive max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="p-4 border-t border-border text-center">
                <Button
                  variant="ghost"
                  onClick={() => setPage(p => p + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memuat...
                    </>
                  ) : (
                    'Muat Lebih Banyak'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
