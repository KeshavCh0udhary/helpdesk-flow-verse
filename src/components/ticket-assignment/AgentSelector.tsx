
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Agent {
  id: string;
  full_name: string;
  email: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  onAssign: (agentId: string) => void;
  disabled: boolean;
}

export const AgentSelector = ({ agents, onAssign, disabled }: AgentSelectorProps) => {
  return (
    <Select onValueChange={onAssign} disabled={disabled}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Assign to agent..." />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
