
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TicketTrendsProps {
  data: Array<{ date: string; count: number }>;
}

export const TicketTrends = ({ data }: TicketTrendsProps) => {
  const chartConfig = {
    count: {
      label: "Tickets",
      color: "#0088FE",
    },
  };

  // Calculate trend
  const getTrend = () => {
    if (data.length < 2) return null;
    const recent = data.slice(-7).reduce((sum, item) => sum + item.count, 0);
    const previous = data.slice(-14, -7).reduce((sum, item) => sum + item.count, 0);
    const change = recent - previous;
    const percentage = previous > 0 ? Math.round((change / previous) * 100) : 0;
    return { change, percentage, isPositive: change >= 0 };
  };

  const trend = getTrend();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Ticket Creation Trends
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${trend.isPositive ? 'text-red-600' : 'text-green-600'}`}>
              {trend.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(trend.percentage)}%
            </div>
          )}
        </CardTitle>
        <CardDescription>Daily ticket creation over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="var(--color-count)" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
