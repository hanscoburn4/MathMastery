import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AddStudentRequest {
  fullName: string;
  email: string;
  classId: string;
  temporaryPassword?: string;
}

interface AddStudentResponse {
  success: boolean;
  student?: {
    id: string;
    email: string;
    fullName: string;
    temporaryPassword: string;
  };
  error?: string;
}

function generateTemporaryPassword(): string {
  const length = 12;
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function handleAddStudent(
  req: Request
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" } as AddStudentResponse),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: AddStudentRequest = await req.json();
    const { fullName, email, classId, temporaryPassword } = body;

    console.log('[ADD_STUDENT] Request received:', { fullName, email, classId });

    if (!fullName || !email || !classId) {
      console.error('[ADD_STUDENT] Missing required fields');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: fullName, email, classId",
        } as AddStudentResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[ADD_STUDENT] Missing environment variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error - missing environment variables",
        } as AddStudentResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[ADD_STUDENT] Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    const password = temporaryPassword || generateTemporaryPassword();

    let authData;
    let authError;

    try {
      console.log('[ADD_STUDENT] Creating user with email:', email.toLowerCase());
      const result = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        user_metadata: {
          full_name: fullName,
          role: "student",
        },
        email_confirm: true,
      });
      authData = result.data;
      authError = result.error;
      console.log('[ADD_STUDENT] User creation result:', { success: !!authData.user, error: authError?.message });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during user creation';
      console.error('[ADD_STUDENT] Exception during user creation:', errorMsg);
      return new Response(
        JSON.stringify({
          success: false,
          error: `User creation exception: ${errorMsg}`,
        } as AddStudentResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (authError) {
      console.error('[ADD_STUDENT] Auth error:', authError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Auth error: ${authError.message || 'Failed to create user account'}`,
        } as AddStudentResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!authData.user) {
      console.error('[ADD_STUDENT] No user returned from auth');
      return new Response(
        JSON.stringify({
          success: false,
          error: "No user object returned from authentication service",
        } as AddStudentResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[ADD_STUDENT] User and profile created via trigger, user ID:', authData.user.id);

    console.log('[ADD_STUDENT] Creating enrollment for class:', classId);
    const { error: enrollmentError } = await supabase
      .from("enrollments")
      .insert({
        class_id: classId,
        student_id: authData.user.id,
      });

    if (enrollmentError) {
      console.error('[ADD_STUDENT] Enrollment error:', enrollmentError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Enrollment failed: ${enrollmentError.message} (Code: ${enrollmentError.code})`,
        } as AddStudentResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        student: {
          id: authData.user.id,
          email: email.toLowerCase(),
          fullName: fullName,
          temporaryPassword: password,
        },
      } as AddStudentResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } as AddStudentResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handleAddStudent);
