
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Award, Clock } from 'lucide-react';

interface AgentData {
  agent: string;
  resolved: number;
  avgTime: number;
  satisfaction?: number;
}

interface AgentPerformanceProps {
  data: AgentData[];
}

export const AgentPerformance = ({ data }: AgentPerformanceProps) => {
  const maxResolved = Math.max(...data.map(agent => agent.resolved));
  const avgResolutionTime = data.reduce((sum, agent) => sum + agent.avgTime, 0) / data.length;

  const getPerformanceScore = (agent: AgentData) => {
    const resolvedScore = (agent.resolved / maxResolved) * 50;
    const timeScore = agent.avgTime > 0 ? Math.max(0, 50 - (agent.avgTime / avgResolutionTime - 1) * 25) : 0;
    return Math.min(100, Math.round(resolvedScore + timeScore));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const sortedAgents = [...data].sort((a, b) => getPerformanceScore(b) - getPerformanceScore(a));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Agent Performance Leaderboard
        </CardTitle>
        <CardDescription>
          Performance metrics and rankings for support agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedAgents.map((agent, index) => {
            const score = getPerformanceScore(agent);
            const isTopPerformer = index < 3;
            
            return (
              <div key={agent.agent} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback>{getInitials(agent.agent)}</AvatarFallback>
                    </Avatar>
                    {isTopPerformer && (
                      <Award className={`absolute -top-1 -right-1 h-4 w-4 ${
                        index === 0 ? 'text-yellow-500' : 
                        index === 1 ? 'text-gray-400' : 'text-amber-600'
                      }`} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">{agent.agent}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>#{index + 1}</span>
                      <Badge variant={isTopPerformer ? "default" : "outline"}>
                        Score: {score}%
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">{agent.resolved}</div>
                    <div className="text-xs text-gray-500">Resolved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{agent.avgTime}h</div>
                    <div className="text-xs text-gray-500">Avg Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-purple-600">
                      {agent.satisfaction || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                </div>
                
                <div className="w-24">
                  <Progress value={score} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
