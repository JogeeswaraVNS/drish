import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Find all expired generations
    const { data: expired, error: fetchErr } = await supabase
      .from("generations")
      .select("id, user_id")
      .lt("expires_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;
    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired generations found", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Found ${expired.length} expired generation(s) to clean up`);

    let deletedCount = 0;
    let storageErrors = 0;

    for (const gen of expired) {
      // Delete storage files for this generation
      const folderPath = `${gen.user_id}/${gen.id}`;
      const { data: files } = await supabase.storage
        .from("carousel-images")
        .list(folderPath);

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${folderPath}/${f.name}`);
        const { error: storageErr } = await supabase.storage
          .from("carousel-images")
          .remove(filePaths);

        if (storageErr) {
          console.error(`Storage cleanup error for ${gen.id}:`, storageErr);
          storageErrors++;
        } else {
          console.log(`Deleted ${filePaths.length} file(s) for generation ${gen.id}`);
        }
      }

      // Delete the generation row (cascades to generation_frames via FK)
      const { error: deleteErr } = await supabase
        .from("generations")
        .delete()
        .eq("id", gen.id);

      if (deleteErr) {
        console.error(`Failed to delete generation ${gen.id}:`, deleteErr);
      } else {
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cleanup complete`,
        deleted: deletedCount,
        storageErrors,
        total: expired.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
