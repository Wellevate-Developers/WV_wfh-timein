import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otpService';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Verify OTP
    const isValid = verifyOTP(email, otp);

    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid or expired OTP' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: 'OTP verified successfully',
      success: true,
    });
  } catch (error) {
    console.error('Error in verify-otp API:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}