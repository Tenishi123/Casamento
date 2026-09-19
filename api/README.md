# API do casamento

API REST em .NET 8 Minimal API com EF Core e SQLite. Em desenvolvimento, o
banco `wedding.db` é criado automaticamente na primeira execução. O Swagger
fica disponível em `http://localhost:5000/swagger` (ou na porta exibida pelo
Kestrel).

## Executar

```bash
cd api
dotnet restore
dotnet run
```

Configure a conexão em `appsettings.json` ou em
`ConnectionStrings__DefaultConnection`. As origens CORS do Vite ficam em
`Cors:AllowedOrigins` (por padrão `http://localhost:5173` e
`http://127.0.0.1:5173`).

## Endpoints

- `GET /api/rsvps` e `GET /api/rsvps/{id}` — listar/consultar confirmações.
- `POST /api/rsvps` — criar confirmação.
- `PUT /api/rsvps/{id}` — atualizar confirmação.
- `GET /api/gifts` e `GET /api/gifts/{id}` — listar presentes e contribuições.
  Cada presente informa `isReserved`, `reservedBy` e `isAvailable`; presentes
  reservados não ficam disponíveis novamente.
- `POST /api/gifts` — cadastrar um presente.
- `POST /api/gifts/{id}/reserve` — reservar um presente uma única vez.
  Recebe `contributorName` e, opcionalmente, `message`; retorna `409 Conflict`
  se o presente já estiver reservado.
- `POST /api/gifts/{id}/contributions` — endpoint legado que registra uma
  contribuição e também reserva o presente (uma única vez).

Exemplos:

```bash
curl -X POST http://localhost:5000/api/rsvps \
  -H "Content-Type: application/json" \
  -d '{"guestName":"Maria Silva","email":"maria@example.com","attendance":"Attending","guestsCount":2}'

curl -X POST http://localhost:5000/api/gifts \
  -H "Content-Type: application/json" \
  -d '{"name":"Lua de mel","description":"Contribuição para a viagem","goalAmount":3000}'

curl -X POST http://localhost:5000/api/gifts/1/reserve \
  -H "Content-Type: application/json" \
  -d '{"contributorName":"João Silva","message":"Com carinho!"}'

curl http://localhost:5000/api/gifts
```

Uma resposta de `GET /api/gifts` inclui, por exemplo:

```json
{
  "id": 1,
  "name": "Lua de mel",
  "isReserved": true,
  "reservedBy": "João Silva",
  "isAvailable": false
}
```

Para produção, use migrations (`dotnet ef database update`) em vez de
`EnsureCreated` e defina uma origem CORS explícita.
