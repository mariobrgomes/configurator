import { BaseError } from "../../lib/errors/shared";

/**
 * Represents a single entity failure in bulk operations
 */
export interface BulkOperationFailure {
  readonly entity: string;
  readonly error: Error;
}

/**
 * Base error class for product-related errors
 *
 * Supports two patterns:
 * 1. Simple: (message, entityIdentifier) - used by ServiceErrorWrapper
 * 2. Full: (message, code, recoverySuggestions, failures, successes) - used by bulk operations
 */
export class ProductError extends BaseError {
  /**
   * Structured failures from bulk operations.
   * Each failure includes the entity name and the original error.
   * This allows the deployment layer to extract detailed failure information.
   */
  public readonly failures?: readonly BulkOperationFailure[];

  /**
   * Names of successfully processed entities in bulk operations.
   * Used to track partial success when some entities fail.
   */
  public readonly successes?: readonly string[];

  constructor(
    message: string,
    entityIdentifierOrCode?: string,
    recoverySuggestions?: string[],
    failures?: readonly BulkOperationFailure[],
    successes?: readonly string[]
  ) {
    // Support both patterns: (message, entityIdentifier) and (message, code, recoverySuggestions)
    if (recoverySuggestions !== undefined) {
      // Full BaseError pattern: (message, code, recoverySuggestions)
      super(message, entityIdentifierOrCode || "PRODUCT_ERROR", recoverySuggestions);
    } else {
      // ServiceErrorWrapper pattern: (message, entityIdentifier)
      super(message, "PRODUCT_ERROR");
    }

    this.failures = failures;
    this.successes = successes;
  }
}

/**
 * Error thrown when a product is not found
 */
export class ProductNotFoundError extends ProductError {
  constructor(productName: string) {
    super(`Product "${productName}" not found`, "PRODUCT_NOT_FOUND_ERROR");
  }
}

/**
 * Error thrown when product creation fails
 */
export class ProductCreationError extends ProductError {
  constructor(
    message: string,
    public readonly productName?: string
  ) {
    super(message, "PRODUCT_CREATION_ERROR");
  }
}

/**
 * Error thrown when product update fails
 */
export class ProductUpdateError extends ProductError {
  constructor(
    message: string,
    public readonly productId?: string
  ) {
    super(message, "PRODUCT_UPDATE_ERROR");
  }
}

/**
 * Error thrown when product variant operation fails
 */
export class ProductVariantError extends ProductError {
  constructor(
    message: string,
    public readonly variantSku?: string
  ) {
    super(message, "PRODUCT_VARIANT_ERROR");
  }
}
