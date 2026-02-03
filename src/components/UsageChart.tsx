import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ChartData {
  date: string;
  total: number;
  success: number;
  error: number;
  tokens: number;
}

interface AnalyticsSummary {
  total_requests: number;
  success_requests: number;
  error_requests: number;
  total_tokens: number;
  success_rate: number;
}

export default function UsageChart() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [data, setData] = useState<ChartData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const { data: result } = await api.get('/analytics', {
        params: { period }
      });
      
      if (result) {
        setData(result.data || []);
        setSummary(result.summary || null);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMM', { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-lg p-3 border border-border shadow-lg">
          <p className="font-medium mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toLocaleString() ?? 0}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Grafik Penggunaan API
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={period === 'weekly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPeriod('weekly')}
            className={period === 'weekly' ? 'bg-primary' : ''}
          >
            <Calendar className="w-4 h-4 mr-1" />
            Mingguan
          </Button>
          <Button
            variant={period === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPeriod('monthly')}
            className={period === 'monthly' ? 'bg-primary' : ''}
          >
            <Calendar className="w-4 h-4 mr-1" />
            Bulanan
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{summary.total_requests?.toLocaleString() ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Request</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{summary.success_requests?.toLocaleString() ?? 0}</p>
            <p className="text-xs text-muted-foreground">Berhasil</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{summary.error_requests?.toLocaleString() ?? 0}</p>
            <p className="text-xs text-muted-foreground">Gagal</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent-foreground">{summary.success_rate ?? 0}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
        </div>
      )}

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada data penggunaan</p>
            <p className="text-sm">Data akan muncul setelah API digunakan</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
              <Bar 
                dataKey="success" 
                name="Berhasil" 
                fill="hsl(var(--success))" 
                radius={[4, 4, 0, 0]}
                stackId="stack"
              />
              <Bar 
                dataKey="error" 
                name="Gagal" 
                fill="hsl(var(--destructive))" 
                radius={[4, 4, 0, 0]}
                stackId="stack"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
