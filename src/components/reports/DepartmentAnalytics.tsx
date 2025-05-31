
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Building, TrendingUp, AlertTriangle } from 'lucide-react';

interface DepartmentData {
  department: string;
  total: number;
  resolved: number;
  pending: number;
  resolutionRate: number;
}

interface DepartmentAnalyticsProps {
  data: DepartmentData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const DepartmentAnalytics = ({ data }: DepartmentAnalyticsProps) => {
  const pieData = data.map(dept => ({
    name: dept.department,
    value: dept.total,
    resolved: dept.resolved,
    pending: dept.pending
  }));

  const barData = data.map(dept => ({
    department: dept.department,
    resolutionRate: dept.resolutionRate,
    total: dept.total
  }));

  const totalTickets = data.reduce((sum, dept) => sum + dept.total, 0);
  const avgResolutionRate = data.reduce((sum, dept) => sum + dept.resolutionRate, 0) / data.length;
  const busiestDept = data.reduce((max, dept) => dept.total > max.total ? dept : max);
  const bestDept = data.reduce((max, dept) => dept.resolutionRate > max.resolutionRate ? dept : max);

  const chartConfig = {
    resolutionRate: {
      label: "Resolution Rate %",
      color: "#00C49F",
    },
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Ticket Distribution by Department
          </CardTitle>
          <CardDescription>
            Total tickets handled by each department
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded shadow">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm">Total: {data.value}</p>
                          <p className="text-sm text-green-600">Resolved: {data.resolved}</p>
                          <p className="text-sm text-orange-600">Pending: {data.pending}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resolution Rates by Department
          </CardTitle>
          <CardDescription>
            Percentage of tickets resolved per department
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="resolutionRate" 
                  fill="var(--color-resolutionRate)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Department Summary</CardTitle>
          <CardDescription>Key metrics and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalTickets}</div>
              <div className="text-sm text-gray-500">Total Tickets</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{avgResolutionRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Avg Resolution Rate</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-orange-600">{busiestDept.department}</div>
              <div className="text-sm text-gray-500">Busiest Department</div>
              <Badge variant="outline" className="mt-1">{busiestDept.total} tickets</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-purple-600">{bestDept.department}</div>
              <div className="text-sm text-gray-500">Best Performance</div>
              <Badge variant="default" className="mt-1">{bestDept.resolutionRate}% resolved</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
