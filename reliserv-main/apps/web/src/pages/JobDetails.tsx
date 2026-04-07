import { useParams } from "react-router-dom";

export default function JobDetails() {
  const { id } = useParams();
  return <div className="p-6">Job {id}</div>;
}