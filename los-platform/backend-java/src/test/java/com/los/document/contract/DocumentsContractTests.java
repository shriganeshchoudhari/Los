package com.los.document.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class DocumentsContractTests {

    @Autowired
    private MockMvc mvc;

    @Test
    void presignedUrlAcceptsPayload() throws Exception {
        String payload = "{\"applicationId\": \"app-1\", \"documentType\": \"BANK_STATEMENT_3M\", \"mimeType\": \"application/pdf\"}";
        mvc.perform(post("/api/documents/presigned-url").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }
}
