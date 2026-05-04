using Recix.Tests.Integration.Infrastructure;

namespace Recix.Tests.Integration;

/// <summary>
/// Agrupa todos os testes de integração em uma coleção serializada.
/// Isso garante que apenas um teste rode por vez, evitando conflitos no banco.
/// A factory (e portanto o app e o banco) é compartilhada entre as classes.
/// </summary>
[CollectionDefinition("Integration")]
public sealed class IntegrationCollection
    : ICollectionFixture<RecixWebApplicationFactory> { }
