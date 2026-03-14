// Публичный профиль пользователя — будет реализован в Шаге 04, 07
export default function ProfilePage({ params }: { params: { username: string } }) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Профиль: @{params.username}</h1>
      <p className="text-mist-dim">Страница профиля (Шаг 04, 07)</p>
    </div>
  );
}
