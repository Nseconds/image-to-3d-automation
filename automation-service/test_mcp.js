const fs = require('fs');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNWU2ZTBiMy00YTA5LTRlOTktYWM2Ny04MTk2ZTA2M2ViMGIiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImNiMDNjNDgxLWVlOWYtNGZlYy04OWU4LTYyYjg2MTAwOTU3NSIsImlhdCI6MTc4NzMxNTk4MH0.eXLFCXTN8jynzpH0P4FiurRUtsLBDTgb_GtB_z77sRs";

async function getWaitParameters() {
  try {
    const res = await fetch("https://nseconds.app.n8n.cloud/mcp-server/http", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "get_node_types",
          arguments: {
            nodeIds: [
              {
                nodeId: "n8n-nodes-base.wait"
              }
            ]
          }
        },
        id: 10
      })
    });
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let dataReceived = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data:")) {
          dataReceived += line.slice(5).trim();
        }
      }
    }
    
    if (buffer.startsWith("data:")) {
      dataReceived += buffer.slice(5).trim();
    }
    
    const parsed = JSON.parse(dataReceived);
    fs.writeFileSync("wait_node_parameters.json", JSON.stringify(parsed, null, 2));
    console.log("Wrote Wait node parameters to wait_node_parameters.json");
  } catch (err) {
    console.error("Error getting Wait node parameters:", err);
  }
}

getWaitParameters();
