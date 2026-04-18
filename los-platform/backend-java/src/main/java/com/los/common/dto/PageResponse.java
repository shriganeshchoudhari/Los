package com.los.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Paginated response wrapper for list endpoints.
 *
 * @param <T> The type of items in the page
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Pagination Response")
public class PageResponse<T> {

    @Schema(description = "List of items")
    private List<T> content;

    @Schema(description = "Current page number (0-indexed)")
    private int pageNumber;

    @Schema(description = "Page size")
    private int pageSize;

    @Schema(description = "Total number of items")
    private long totalElements;

    @Schema(description = "Total number of pages")
    private int totalPages;

    @Schema(description = "Is first page")
    private boolean first;

    @Schema(description = "Is last page")
    private boolean last;

    /**
     * Create page response from Spring Data Page
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        return PageResponse.<T>builder()
                .content(page.getContent())
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }
}
