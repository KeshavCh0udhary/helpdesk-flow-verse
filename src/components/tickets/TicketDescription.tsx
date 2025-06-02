
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TicketDescriptionProps {
  description: string;
}

export const TicketDescription = ({ description }: TicketDescriptionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{description}</p>
      </CardContent>
    </Card>
  );
};
