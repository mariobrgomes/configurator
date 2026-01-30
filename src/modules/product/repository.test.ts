import type { Client } from "@urql/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductRepository } from "./repository";

/**
 * Creates a mock URQL client for testing repository methods
 */
function createMockClient() {
  return {
    query: vi.fn(),
    mutation: vi.fn(),
  } as unknown as Client;
}

/**
 * Creates a mock page response for pagination tests.
 * Includes required URQL OperationResult fields.
 */
function createMockProductPage(
  products: Array<{ id: string; slug: string; name: string }>,
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
) {
  return {
    data: {
      products: {
        pageInfo,
        edges: products.map((product) => ({
          node: product,
        })),
      },
    },
    error: undefined,
    // Required URQL OperationResult fields
    operation: {} as any,
    stale: false,
    hasNext: false,
  };
}

describe("ProductRepository", () => {
  let mockClient: Client;
  let repository: ProductRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    repository = new ProductRepository(mockClient);
  });

  describe("getProductsBySlugs", () => {
    it("should return empty array for empty slugs input", async () => {
      const result = await repository.getProductsBySlugs([]);

      expect(result).toEqual([]);
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it("should fetch single page when count is under 100", async () => {
      const products = [
        { id: "prod-1", slug: "product-1", name: "Product 1" },
        { id: "prod-2", slug: "product-2", name: "Product 2" },
      ];

      vi.mocked(mockClient.query).mockResolvedValueOnce(
        createMockProductPage(products, { hasNextPage: false, endCursor: null })
      );

      const result = await repository.getProductsBySlugs(["product-1", "product-2"]);

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("product-1");
      expect(result[1].slug).toBe("product-2");
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it("should paginate when count exceeds 100", async () => {
      // First page: 100 products
      const page1Products = Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i + 1}`,
        slug: `product-${i + 1}`,
        name: `Product ${i + 1}`,
      }));

      // Second page: 50 more products
      const page2Products = Array.from({ length: 50 }, (_, i) => ({
        id: `prod-${i + 101}`,
        slug: `product-${i + 101}`,
        name: `Product ${i + 101}`,
      }));

      vi.mocked(mockClient.query)
        .mockResolvedValueOnce(
          createMockProductPage(page1Products, { hasNextPage: true, endCursor: "cursor-page-1" })
        )
        .mockResolvedValueOnce(
          createMockProductPage(page2Products, { hasNextPage: false, endCursor: null })
        );

      const slugs = Array.from({ length: 150 }, (_, i) => `product-${i + 1}`);
      const result = await repository.getProductsBySlugs(slugs);

      expect(result).toHaveLength(150);
      expect(mockClient.query).toHaveBeenCalledTimes(2);

      // Verify cursor is passed in second call
      const secondCall = vi.mocked(mockClient.query).mock.calls[1];
      expect(secondCall[1]).toMatchObject({ after: "cursor-page-1" });
    });

    it("should stop pagination when API returns hasNextPage=true but no endCursor", async () => {
      // This tests the infinite loop guard
      const products = [{ id: "prod-1", slug: "product-1", name: "Product 1" }];

      vi.mocked(mockClient.query).mockResolvedValueOnce(
        // Malformed response: hasNextPage=true but no cursor
        createMockProductPage(products, { hasNextPage: true, endCursor: null })
      );

      const result = await repository.getProductsBySlugs(["product-1"]);

      // Should stop after first page despite hasNextPage=true
      expect(result).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it("should throw GraphQLError on query failure", async () => {
      const mockError = {
        message: "Network error",
        graphQLErrors: [],
        networkError: new Error("Connection refused"),
        name: "CombinedError",
      };

      vi.mocked(mockClient.query).mockResolvedValueOnce({
        data: undefined,
        error: mockError as any,
        operation: {} as any,
        stale: false,
        hasNext: false,
      });

      await expect(repository.getProductsBySlugs(["product-1"])).rejects.toThrow(
        "Failed to fetch products by slugs"
      );
    });

    it("should handle partial page results (less than 100 items)", async () => {
      const products = Array.from({ length: 37 }, (_, i) => ({
        id: `prod-${i + 1}`,
        slug: `product-${i + 1}`,
        name: `Product ${i + 1}`,
      }));

      vi.mocked(mockClient.query).mockResolvedValueOnce(
        createMockProductPage(products, { hasNextPage: false, endCursor: null })
      );

      const result = await repository.getProductsBySlugs(products.map((p) => p.slug));

      expect(result).toHaveLength(37);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it("should filter out null nodes from results", async () => {
      // Response with a null node mixed in
      const response = {
        data: {
          products: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [
              { node: { id: "prod-1", slug: "product-1", name: "Product 1" } },
              { node: null },
              { node: { id: "prod-2", slug: "product-2", name: "Product 2" } },
            ],
          },
        },
        error: undefined,
        operation: {} as any,
        stale: false,
        hasNext: false,
      };

      vi.mocked(mockClient.query).mockResolvedValueOnce(response as any);

      const result = await repository.getProductsBySlugs(["product-1", "product-2"]);

      expect(result).toHaveLength(2);
      expect(result.every((p) => p !== null)).toBe(true);
    });

    it("should handle empty page data gracefully", async () => {
      vi.mocked(mockClient.query).mockResolvedValueOnce({
        data: { products: null },
        error: undefined,
        operation: {} as any,
        stale: false,
        hasNext: false,
      });

      const result = await repository.getProductsBySlugs(["product-1"]);

      expect(result).toEqual([]);
    });
  });
});
