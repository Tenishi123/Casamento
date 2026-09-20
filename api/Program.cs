using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

var logFilePath = builder.Configuration["Logging:FilePath"] ?? "logs/api-.log";
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File(
        logFilePath,
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        shared: true,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}")
    .CreateLogger();
builder.Host.UseSerilog();

builder.Services.AddDbContext<WeddingDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=wedding.db"));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
                "https://tenishi123.github.io"
            ];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WeddingDbContext>();
    var databaseCreated = db.Database.EnsureCreated();
    EnsureGiftReservationColumns(db);
    Log.Information(
        databaseCreated
            ? "Banco SQLite criado e schema inicializado."
            : "Banco SQLite já existente; schema verificado.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");

app.MapGet("/api/rsvps", async (WeddingDbContext db) =>
    Results.Ok(await db.Rsvps.AsNoTracking().OrderByDescending(r => r.Id).ToListAsync()));

app.MapGet("/api/rsvps/{id:int}", async (int id, WeddingDbContext db) =>
{
    var rsvp = await db.Rsvps.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
    return rsvp is null ? Results.NotFound() : Results.Ok(rsvp);
});

app.MapPost("/api/rsvps", async (CreateRsvpRequest request, WeddingDbContext db) =>
{
    var validation = Validate(request);
    if (validation is not null) return Results.ValidationProblem(validation);

    var rsvp = new Rsvp
    {
        GuestName = request.GuestName.Trim(),
        Email = request.Email?.Trim(),
        Attendance = request.Attendance,
        GuestsCount = request.GuestsCount,
        Message = request.Message?.Trim(),
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Rsvps.Add(rsvp);
    await db.SaveChangesAsync();
    return Results.Created($"/api/rsvps/{rsvp.Id}", rsvp);
});

app.MapPut("/api/rsvps/{id:int}", async (int id, UpdateRsvpRequest request, WeddingDbContext db) =>
{
    var validation = Validate(request);
    if (validation is not null) return Results.ValidationProblem(validation);
    var rsvp = await db.Rsvps.FindAsync(id);
    if (rsvp is null) return Results.NotFound();

    rsvp.GuestName = request.GuestName.Trim();
    rsvp.Email = request.Email?.Trim();
    rsvp.Attendance = request.Attendance;
    rsvp.GuestsCount = request.GuestsCount;
    rsvp.Message = request.Message?.Trim();
    rsvp.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(rsvp);
});

app.MapGet("/api/gifts", async (WeddingDbContext db) =>
{
    var gifts = await db.Gifts.AsNoTracking().Include(g => g.Contributions)
        .OrderBy(g => g.Name).ToListAsync();
    return Results.Ok(gifts.Select(g => new GiftResponse(g)));
});

app.MapGet("/api/gifts/{id:int}", async (int id, WeddingDbContext db) =>
{
    var gift = await db.Gifts.AsNoTracking().Include(g => g.Contributions)
        .FirstOrDefaultAsync(g => g.Id == id);
    return gift is null ? Results.NotFound() : Results.Ok(new GiftResponse(gift));
});

app.MapPost("/api/gifts", async (CreateGiftRequest request, WeddingDbContext db) =>
{
    var validation = Validate(request);
    if (validation is not null) return Results.ValidationProblem(validation);
    var gift = new Gift
    {
        Name = request.Name.Trim(),
        Description = request.Description?.Trim(),
        GoalAmount = request.GoalAmount
    };
    db.Gifts.Add(gift);
    await db.SaveChangesAsync();
    return Results.Created($"/api/gifts/{gift.Id}", new GiftResponse(gift));
});

app.MapPost("/api/gifts/{giftId:int}/reserve",
    async (int giftId, ReserveGiftRequest request, WeddingDbContext db) =>
{
    var validation = Validate(request);
    if (validation is not null) return Results.ValidationProblem(validation);

    var reservedAt = DateTimeOffset.UtcNow;
    var updated = await db.Gifts
        .Where(g => g.Id == giftId && g.ReservedBy == null)
        .ExecuteUpdateAsync(setters => setters
            .SetProperty(g => g.ReservedBy, request.ContributorName.Trim())
            .SetProperty(g => g.ReservedMessage, request.Message == null ? null : request.Message.Trim())
            .SetProperty(g => g.ReservedAt, reservedAt));

    if (updated == 0)
    {
        return await db.Gifts.AnyAsync(g => g.Id == giftId)
            ? Results.Conflict(new { message = "Este presente já foi reservado." })
            : Results.NotFound();
    }

    var gift = await db.Gifts.AsNoTracking().Include(g => g.Contributions)
        .SingleAsync(g => g.Id == giftId);
    return Results.Ok(new GiftResponse(gift));
});

app.MapPost("/api/gifts/{giftId:int}/contributions",
    async (int giftId, CreateContributionRequest request, WeddingDbContext db) =>
{
    var validation = Validate(request);
    if (validation is not null) return Results.ValidationProblem(validation);

    await using var transaction = await db.Database.BeginTransactionAsync();
    var reserved = await db.Gifts
        .Where(g => g.Id == giftId && g.ReservedBy == null)
        .ExecuteUpdateAsync(setters => setters
            .SetProperty(g => g.ReservedBy, request.ContributorName.Trim())
            .SetProperty(g => g.ReservedMessage, request.Message == null ? null : request.Message.Trim())
            .SetProperty(g => g.ReservedAt, DateTimeOffset.UtcNow));
    if (reserved == 0)
    {
        await transaction.RollbackAsync();
        return await db.Gifts.AnyAsync(g => g.Id == giftId)
            ? Results.Conflict(new { message = "Este presente já foi reservado." })
            : Results.NotFound();
    }

    var contribution = new GiftContribution
    {
        GiftId = giftId,
        ContributorName = request.ContributorName.Trim(),
        Amount = request.Amount,
        Message = request.Message?.Trim(),
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.GiftContributions.Add(contribution);
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Created($"/api/gifts/{giftId}/contributions/{contribution.Id}",
        new ContributionResponse(contribution));
});

try
{
    app.Run();
}
catch (Exception exception)
{
    Log.Fatal(exception, "A API foi encerrada inesperadamente.");
}
finally
{
    Log.CloseAndFlush();
}

static Dictionary<string, string[]>? Validate<T>(T request) where T : class
{
    var context = new ValidationContext(request);
    var errors = new List<ValidationResult>();
    if (Validator.TryValidateObject(request, context, errors, true)) return null;
    return errors.GroupBy(e => e.MemberNames.FirstOrDefault() ?? "request")
        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage ?? "Invalid value").ToArray());
}

static void EnsureGiftReservationColumns(WeddingDbContext db)
{
    var connection = db.Database.GetDbConnection();
    connection.Open();
    using var columnsCommand = connection.CreateCommand();
    columnsCommand.CommandText = "PRAGMA table_info(\"Gifts\")";
    using var reader = columnsCommand.ExecuteReader();
    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    while (reader.Read()) columns.Add(reader.GetString(1));
    reader.Close();

    foreach (var column in new[] { ("ReservedBy", "TEXT"), ("ReservedMessage", "TEXT"),
                                   ("ReservedAt", "TEXT") })
    {
        if (columns.Contains(column.Item1)) continue;
        using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE \"Gifts\" ADD COLUMN \"{column.Item1}\" {column.Item2} NULL";
        alter.ExecuteNonQuery();
    }
}

public partial class Program { }

public enum Attendance
{
    Pending,
    Attending,
    NotAttending
}

public class Rsvp
{
    public int Id { get; set; }
    [MaxLength(160)] public string GuestName { get; set; } = "";
    [MaxLength(320), EmailAddress] public string? Email { get; set; }
    public Attendance Attendance { get; set; } = Attendance.Pending;
    [Range(1, 20)] public int GuestsCount { get; set; } = 1;
    [MaxLength(1000)] public string? Message { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class Gift
{
    public int Id { get; set; }
    [MaxLength(180)] public string Name { get; set; } = "";
    [MaxLength(1000)] public string? Description { get; set; }
    [Range(0, 100000000)] public decimal GoalAmount { get; set; }
    [MaxLength(160)] public string? ReservedBy { get; set; }
    [MaxLength(500)] public string? ReservedMessage { get; set; }
    public DateTimeOffset? ReservedAt { get; set; }
    [NotMapped] public bool IsReserved => ReservedBy is not null;
    public List<GiftContribution> Contributions { get; set; } = [];
}

public class GiftContribution
{
    public int Id { get; set; }
    public int GiftId { get; set; }
    public Gift? Gift { get; set; }
    [MaxLength(160)] public string ContributorName { get; set; } = "";
    [Range(0.01, 100000000)] public decimal Amount { get; set; }
    [MaxLength(500)] public string? Message { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public record CreateRsvpRequest(
    [property: Required, StringLength(160, MinimumLength = 2)] string GuestName,
    [property: EmailAddress, StringLength(320)] string? Email,
    Attendance Attendance = Attendance.Pending,
    [property: Range(1, 20)] int GuestsCount = 1,
    [property: StringLength(1000)] string? Message = null);
public record UpdateRsvpRequest(
    [property: Required, StringLength(160, MinimumLength = 2)] string GuestName,
    [property: EmailAddress, StringLength(320)] string? Email,
    Attendance Attendance,
    [property: Range(1, 20)] int GuestsCount,
    [property: StringLength(1000)] string? Message);
public record CreateContributionRequest(
    [property: Required, StringLength(160, MinimumLength = 2)] string ContributorName,
    [property: Range(0.01, 100000000)] decimal Amount,
    [property: StringLength(500)] string? Message = null);
public record ReserveGiftRequest(
    [property: Required, StringLength(160, MinimumLength = 2)] string ContributorName,
    [property: StringLength(500)] string? Message = null);
public record CreateGiftRequest(
    [property: Required, StringLength(180, MinimumLength = 2)] string Name,
    [property: StringLength(1000)] string? Description,
    [property: Range(0, 100000000)] decimal GoalAmount);
public record ContributionResponse(int Id, int GiftId, string ContributorName, decimal Amount,
    string? Message, DateTimeOffset CreatedAt)
{
    public ContributionResponse(GiftContribution contribution) : this(contribution.Id,
        contribution.GiftId, contribution.ContributorName, contribution.Amount,
        contribution.Message, contribution.CreatedAt) { }
}
public record GiftResponse(int Id, string Name, string? Description, decimal GoalAmount,
    decimal ContributedAmount, bool IsComplete, bool IsReserved, string? ReservedBy,
    bool IsAvailable, IReadOnlyList<ContributionResponse> Contributions)
{
    public GiftResponse(Gift gift) : this(gift.Id, gift.Name, gift.Description, gift.GoalAmount,
        gift.Contributions.Sum(c => c.Amount), gift.GoalAmount > 0 &&
        gift.Contributions.Sum(c => c.Amount) >= gift.GoalAmount, gift.IsReserved,
        gift.ReservedBy, !gift.IsReserved,
        gift.Contributions.Select(c => new ContributionResponse(c)).ToList()) { }
}
