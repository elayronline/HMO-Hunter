"use client"

import Link from "next/link"
import { ArrowLeft, Shield, Mail, Clock, UserX, FileText } from "lucide-react"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold">Privacy Policy</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <p className="text-sm text-gray-500 mb-6">Last updated: January 2025 | Version 1.0</p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              HMO Hunter ("we", "us", "our") is committed to protecting the privacy of individuals whose data we process.
              This policy explains how we collect, use, and protect personal data in compliance with the UK General Data
              Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              We are registered with the Information Commissioner's Office (ICO) as required by law.
            </p>
          </section>

          {/* What We Collect */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">2. What Personal Data We Collect</h2>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">2.1 Property Owner Data</h3>
            <p className="text-gray-700 mb-2">We collect the following data about property owners from official public registers and licensed data providers:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Owner names (from official property registers)</li>
              <li>Registered addresses</li>
              <li>Company details for corporate landlords (from official company registers)</li>
              <li>Contact telephone numbers (from licensed tracing services)</li>
              <li>Contact email addresses (from licensed tracing services)</li>
              <li>HMO licence information (from council public registers)</li>
            </ul>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">2.2 User Data</h3>
            <p className="text-gray-700 mb-2">We collect the following data about our users:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Email address and name (for account creation)</li>
              <li>Usage data (properties viewed, searches performed)</li>
              <li>IP address and browser information (for security)</li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">3. Legal Basis for Processing</h2>
            <p className="text-gray-700 mb-3">We process personal data under the following lawful bases:</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">Legitimate Interest (Article 6(1)(f) UK GDPR)</h4>
              <p className="text-blue-800 text-sm">
                We have a legitimate interest in facilitating property transactions between investors and landlords.
                Property ownership is a matter of public record, and our processing enables legitimate business
                communications about property transactions.
              </p>
            </div>

            <p className="text-gray-700">
              We have conducted a Legitimate Interest Assessment (LIA) which concluded that our processing does not
              override the rights and freedoms of data subjects, as:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mt-2">
              <li>Property ownership is publicly registered</li>
              <li>Contact is limited to legitimate property transaction enquiries</li>
              <li>Data subjects can opt out at any time</li>
              <li>We do not sell data to third parties</li>
            </ul>
          </section>

          {/* How We Use Data */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">4. How We Use Personal Data</h2>
            <p className="text-gray-700 mb-2">We use property owner data solely for:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Displaying ownership information to registered users</li>
              <li>Enabling users to contact property owners about potential transactions</li>
              <li>Verifying property licensing status</li>
            </ul>
            <p className="text-gray-700 mt-3">
              <strong>We do NOT:</strong> sell personal data, use it for unrelated marketing, or share it with third
              parties except as required by law.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              5. Data Retention
            </h2>
            <p className="text-gray-700">We retain personal data as follows:</p>
            <table className="w-full mt-3 border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium">Data Type</th>
                  <th className="text-left px-4 py-2 text-sm font-medium">Retention Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-700">Contact details (phone/email)</td>
                  <td className="px-4 py-2 text-sm text-gray-700">24 months from collection</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-700">Owner names and addresses</td>
                  <td className="px-4 py-2 text-sm text-gray-700">Until property changes ownership</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-700">Access audit logs</td>
                  <td className="px-4 py-2 text-sm text-gray-700">6 years (legal requirement)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-700">User account data</td>
                  <td className="px-4 py-2 text-sm text-gray-700">Until account deletion</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <UserX className="w-5 h-5 text-gray-600" />
              6. Your Rights
            </h2>
            <p className="text-gray-700 mb-3">Under UK GDPR, you have the following rights:</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-1">Right to Access</h4>
                <p className="text-sm text-gray-600">Request a copy of the data we hold about you</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-1">Right to Erasure</h4>
                <p className="text-sm text-gray-600">Request deletion of your personal data</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-1">Right to Rectification</h4>
                <p className="text-sm text-gray-600">Request correction of inaccurate data</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-1">Right to Object</h4>
                <p className="text-sm text-gray-600">Object to processing based on legitimate interest</p>
              </div>
            </div>
          </section>

          {/* How to Exercise Rights */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-600" />
              7. How to Exercise Your Rights
            </h2>
            <p className="text-gray-700 mb-4">
              If you are a property owner and wish to have your contact details removed, or if you wish to exercise
              any of your data protection rights, you can:
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-900 font-medium mb-2">Submit a Data Request</p>
              <p className="text-amber-800 text-sm mb-3">
                Use our online form to request access to, correction of, or deletion of your personal data.
              </p>
              <Link
                href="/data-request"
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Submit Data Request
              </Link>
            </div>

            <p className="text-gray-700 mt-4">
              We will respond to all valid requests within 30 days. You can also contact us directly at:{" "}
              <a href="mailto:privacy@hmohunter.com" className="text-blue-600 hover:underline">
                privacy@hmohunter.com
              </a>
            </p>
          </section>

          {/* Data Sources */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">8. Data Sources</h2>
            <p className="text-gray-700 mb-2">We obtain property owner data from the following sources:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li><strong>Official Property Registers</strong> - Owner names and registered addresses (public record)</li>
              <li><strong>Company Registers</strong> - Company details and directors (public record)</li>
              <li><strong>Council HMO Registers</strong> - Licence holder names (public record)</li>
              <li><strong>Licensed Data Providers</strong> - Contact details from GDPR-compliant tracing services</li>
            </ul>
          </section>

          {/* Security */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">9. Data Security</h2>
            <p className="text-gray-700">
              We implement appropriate technical and organisational measures to protect personal data, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4 mt-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Access controls limiting who can view contact data</li>
              <li>Audit logging of all access to personal data</li>
              <li>Regular security assessments</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">10. Contact Us</h2>
            <p className="text-gray-700">
              For any questions about this privacy policy or our data practices, contact us at:
            </p>
            <div className="mt-3 text-gray-700">
              <p><strong>Email:</strong> <a href="mailto:privacy@hmohunter.com" className="text-blue-600 hover:underline">privacy@hmohunter.com</a></p>
              <p className="mt-1"><strong>ICO Registration:</strong> [Registration Number - to be added after registration]</p>
            </div>
          </section>

          {/* Complaints */}
          <section>
            <h2 className="text-lg font-semibold mb-3">11. Complaints</h2>
            <p className="text-gray-700">
              If you are not satisfied with how we handle your data, you have the right to lodge a complaint with the
              Information Commissioner's Office (ICO):
            </p>
            <p className="mt-2 text-gray-700">
              <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                https://ico.org.uk/make-a-complaint/
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
