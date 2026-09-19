using Microsoft.EntityFrameworkCore;

public class WeddingDbContext(DbContextOptions<WeddingDbContext> options) : DbContext(options)
{
    public DbSet<Rsvp> Rsvps => Set<Rsvp>();
    public DbSet<Gift> Gifts => Set<Gift>();
    public DbSet<GiftContribution> GiftContributions => Set<GiftContribution>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GiftContribution>()
            .HasOne(c => c.Gift)
            .WithMany(g => g.Contributions)
            .HasForeignKey(c => c.GiftId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Gift>().Property(g => g.GoalAmount).HasPrecision(18, 2);
        modelBuilder.Entity<Gift>().Property(g => g.ReservedBy).HasMaxLength(160);
        modelBuilder.Entity<Gift>().Property(g => g.ReservedMessage).HasMaxLength(500);
        modelBuilder.Entity<GiftContribution>().Property(c => c.Amount).HasPrecision(18, 2);
    }
}
