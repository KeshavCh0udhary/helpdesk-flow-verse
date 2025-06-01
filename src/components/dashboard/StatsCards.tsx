
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Clock, 
  Play, 
  CheckCircle2 
} from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
  };
}

export const StatsCards = ({ stats }: StatsCardsProps) => {
  const cards = [
    {
      title: "Total Tickets",
      value: stats.totalTickets,
      description: "All time tickets",
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/tickets?status=all"
    },
    {
      title: "Open Tickets", 
      value: stats.openTickets,
      description: "Awaiting assignment",
      icon: Clock,
      color: "text-red-600",
      bgColor: "bg-red-50",
      link: "/tickets?status=open"
    },
    {
      title: "In Progress",
      value: stats.inProgressTickets,
      description: "Being worked on",
      icon: Play,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      link: "/tickets?status=in_progress"
    },
    {
      title: "Resolved",
      value: stats.resolvedTickets,
      description: "Completed tickets",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/tickets?status=resolved"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <Link key={card.title} to={card.link} className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${card.bgColor}`}>
                  <IconComponent className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};
