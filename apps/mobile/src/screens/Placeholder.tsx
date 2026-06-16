import { Screen, Card, Txt } from '../components/base';
import { S } from '../theme';

/** Privremeni ekran dok se ne izgradi (Faza 4 ide ekran po ekran). */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <Txt variant="h1" style={{ marginBottom: S.md }}>
        {title}
      </Txt>
      <Card>
        <Txt color="#9AA0AA">Uskoro.</Txt>
      </Card>
    </Screen>
  );
}
