import { notFound } from "next/navigation"
import { getPropertyById } from "@/app/actions/properties"
import { PropertyDetailPageClient } from "@/components/property-detail-page"

interface PropertyPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params
  const property = await getPropertyById(id)

  if (!property) {
    notFound()
  }

  return <PropertyDetailPageClient property={property} />
}
