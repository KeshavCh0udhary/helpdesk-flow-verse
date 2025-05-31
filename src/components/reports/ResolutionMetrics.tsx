
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Clock, Target } from 'lucide-react';

interface ResolutionMetricsProps {
  data: Array<{ department: string; avgHours: number; totalResolved: number }>;
}

export const ResolutionMetrics = ({ data }: ResolutionMetricsProps) => {
  const chartConfig = {
    avgHours: {
      label: "Avg Hours",
      color: "#00C49F",
    },
  };

  const overallAvg = data.reduce((sum, dept) => sum + dept.avgHours, 0) / data.length;
  const bestPerformer = data.reduce((best, dept) => 
    dept.avgHours < best.avgHours ? dept : best
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Resolution Time by Department
        </CardTitle>
        <CardDescription>
          Average time to resolve tickets across departments
        </CardDescription>
        <div className="flex gap-4 mt-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Overall: {overallAvg.toFixed(1)}h
          </Badge>
          <Badge variant="default">
            Best: {bestPerformer.department} ({bestPerformer.avgHours.toFixed(1)}h)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar 
                dataKey="avgHours" 
                fill="var(--color-avgHours)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
