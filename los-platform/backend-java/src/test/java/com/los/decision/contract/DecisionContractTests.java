package com.los.decision.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class DecisionContractTests {

    @Autowired
    private MockMvc mvc;

    @Test
    void triggerDecisionAcceptsAliasOverrideNotes() throws Exception {
        String payload = "{\"applicationId\": \"app-1\", \"forceRerun\": true, \"overrideNotes\": \"ctx\"}";
        mvc.perform(post("/api/decisions/trigger").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }

    @Test
    void manualOverrideAcceptsDecisionAlias() throws Exception {
        String payload = "{\"applicationId\": \"app-1\", \"decision\": \"APPROVE\", \"rejectionReasonCode\": \"OTHER\", \"remarks\": \"ok\"}";
        mvc.perform(post("/api/decisions/override").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }
}
